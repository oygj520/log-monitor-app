const initSqlJs = require('sql.js');
const PathManager = require('./pathManager');
const path = require('path');
const fs = require('fs');

class DatabaseService {
  constructor() {
    this.db = null;
    this.SQL = null;
    this.dbPath = null;
  }

  /**
   * 初始化数据库
   */
  async initialize() {
    this.dbPath = PathManager.getDatabasePath();
    console.log('初始化数据库:', this.dbPath);
    
    try {
      // 初始化 sql.js
      this.SQL = await initSqlJs();
      
      // 检查数据库文件是否存在
      if (fs.existsSync(this.dbPath)) {
        // 读取现有数据库文件
        const fileBuffer = fs.readFileSync(this.dbPath);
        this.db = new this.SQL.Database(fileBuffer);
        console.log('加载现有数据库成功');
      } else {
        // 创建新数据库
        this.db = new this.SQL.Database();
        this.createTables();
        this.saveDatabase();
        console.log('创建新数据库成功');
      }
      
      console.log('数据库初始化成功');
    } catch (error) {
      console.error('数据库初始化失败:', error);
      throw error;
    }
  }

  /**
   * 保存数据库到文件
   */
  saveDatabase() {
    if (!this.db) return;
    
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
    } catch (error) {
      console.error('保存数据库失败:', error);
    }
  }

  /**
   * 创建数据表
   */
  createTables() {
    // 日志表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        filePath TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        source TEXT NOT NULL,
        raw TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建索引
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
      CREATE INDEX IF NOT EXISTS idx_logs_source ON logs(source);
      CREATE INDEX IF NOT EXISTS idx_logs_filepath ON logs(filePath);
    `);

    // 监控配置表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS monitor_configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        paths TEXT NOT NULL,
        alertKeywords TEXT,
        customKeywords TEXT,
        status TEXT DEFAULT 'stopped',
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 告警记录表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        monitorId TEXT NOT NULL,
        type TEXT NOT NULL,
        level TEXT,
        message TEXT NOT NULL,
        logId TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建索引
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_alerts_monitorId ON alerts(monitorId);
      CREATE INDEX IF NOT EXISTS idx_alerts_createdAt ON alerts(createdAt);
    `);
  }

  /**
   * 保存日志
   */
  saveLogs(logs) {
    if (!this.db) return;

    try {
      this.db.exec('BEGIN TRANSACTION');

      for (const log of logs) {
        this.db.exec(`
          INSERT OR REPLACE INTO logs (id, filePath, timestamp, level, message, source, raw)
          VALUES ('${log.id}', '${log.filePath}', '${log.timestamp}', '${log.level}', '${log.message}', '${log.source}', '${log.raw || ''}')
        `);
      }

      this.db.exec('COMMIT');
      this.saveDatabase();
    } catch (error) {
      this.db.exec('ROLLBACK');
      console.error('保存日志失败:', error);
    }
  }

  /**
   * 查询日志
   */
  getLogs(options = {}) {
    if (!this.db) return [];

    const {
      page = 1,
      pageSize = 100,
      level,
      keyword,
      startDate,
      endDate,
      source,
      filePath
    } = options;

    let query = 'SELECT * FROM logs WHERE 1=1';
    const conditions = [];

    if (level) {
      conditions.push(`level = '${level}'`);
    }

    if (keyword) {
      conditions.push(`message LIKE '%${keyword}%'`);
    }

    if (startDate) {
      conditions.push(`timestamp >= '${startDate}'`);
    }

    if (endDate) {
      conditions.push(`timestamp <= '${endDate}'`);
    }

    if (source) {
      conditions.push(`source = '${source}'`);
    }

    if (filePath) {
      conditions.push(`filePath LIKE '%${filePath}%'`);
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    query += ' ORDER BY timestamp DESC';
    query += ` LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;

    const stmt = this.db.prepare(query);
    const results = [];
    
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();

    return results;
  }

  /**
   * 获取统计信息
   */
  getStatistics(options = {}) {
    if (!this.db) return {};

    const { startDate, endDate } = options;
    
    let whereClause = 'WHERE 1=1';
    const conditions = [];

    if (startDate) {
      conditions.push(`timestamp >= '${startDate}'`);
    }

    if (endDate) {
      conditions.push(`timestamp <= '${endDate}'`);
    }

    if (conditions.length > 0) {
      whereClause += ' AND ' + conditions.join(' AND ');
    }

    // 按级别统计
    const levelStatsQuery = `
      SELECT level, COUNT(*) as count
      FROM logs ${whereClause}
      GROUP BY level
      ORDER BY count DESC
    `;
    const levelStats = this.executeQuery(levelStatsQuery);

    // 按来源统计
    const sourceStatsQuery = `
      SELECT source, COUNT(*) as count
      FROM logs ${whereClause}
      GROUP BY source
      ORDER BY count DESC
      LIMIT 20
    `;
    const sourceStats = this.executeQuery(sourceStatsQuery);

    // 总数
    const totalQuery = `
      SELECT COUNT(*) as count FROM logs ${whereClause}
    `;
    const totalResult = this.db.prepare(totalQuery);
    const total = totalResult.step() ? totalResult.getAsObject().count : 0;
    totalResult.free();

    // 时间趋势（按小时）
    const timeTrendQuery = `
      SELECT strftime('%Y-%m-%d %H:00', timestamp) as hour, COUNT(*) as count
      FROM logs ${whereClause}
      GROUP BY hour
      ORDER BY hour DESC
      LIMIT 48
    `;
    const timeTrend = this.executeQuery(timeTrendQuery);

    return {
      total: total,
      byLevel: levelStats,
      bySource: sourceStats,
      timeTrend
    };
  }

  /**
   * 执行查询并返回结果
   */
  executeQuery(query) {
    const stmt = this.db.prepare(query);
    const results = [];
    
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    
    return results;
  }

  /**
   * 保存监控配置
   */
  saveMonitorConfig(config) {
    if (!this.db) return;

    try {
      this.db.exec(`
        INSERT OR REPLACE INTO monitor_configs 
        (id, name, paths, alertKeywords, customKeywords, status, updatedAt)
        VALUES ('${config.id}', '${config.name}', '${JSON.stringify(config.paths)}', '${JSON.stringify(config.alertKeywords || [])}', '${JSON.stringify(config.customKeywords || [])}', '${config.status || 'stopped'}', CURRENT_TIMESTAMP)
      `);
      this.saveDatabase();
    } catch (error) {
      console.error('保存监控配置失败:', error);
    }
  }

  /**
   * 获取所有监控配置
   */
  getMonitorConfigs() {
    if (!this.db) return [];

    const query = 'SELECT * FROM monitor_configs ORDER BY createdAt DESC';
    const stmt = this.db.prepare(query);
    const configs = [];

    while (stmt.step()) {
      const row = stmt.getAsObject();
      configs.push({
        ...row,
        paths: JSON.parse(row.paths),
        alertKeywords: JSON.parse(row.alertKeywords),
        customKeywords: JSON.parse(row.customKeywords)
      });
    }
    stmt.free();

    return configs;
  }

  /**
   * 保存告警记录
   */
  saveAlert(alert) {
    if (!this.db) return;

    try {
      this.db.exec(`
        INSERT INTO alerts (id, monitorId, type, level, message, logId)
        VALUES ('${alert.id}', '${alert.monitorId}', '${alert.type}', '${alert.level || ''}', '${alert.message}', '${alert.logId || ''}')
      `);
      this.saveDatabase();
    } catch (error) {
      console.error('保存告警记录失败:', error);
    }
  }

  /**
   * 获取告警记录
   */
  getAlerts(options = {}) {
    if (!this.db) return [];

    const { page = 1, pageSize = 50, monitorId } = options;

    let query = 'SELECT * FROM alerts WHERE 1=1';
    const conditions = [];

    if (monitorId) {
      conditions.push(`monitorId = '${monitorId}'`);
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    query += ' ORDER BY createdAt DESC';
    query += ` LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;

    const stmt = this.db.prepare(query);
    const results = [];
    
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();

    return results;
  }

  /**
   * 关闭数据库
   */
  close() {
    if (this.db) {
      this.saveDatabase();
      this.db.close();
      this.db = null;
      this.SQL = null;
    }
  }
}

module.exports = DatabaseService;
