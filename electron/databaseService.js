const Database = require('better-sqlite3');
const PathManager = require('./pathManager');
const path = require('path');

class DatabaseService {
  constructor() {
    this.db = null;
  }

  /**
   * 初始化数据库
   */
  initialize() {
    const dbPath = PathManager.getDatabasePath();
    console.log('初始化数据库:', dbPath);
    
    try {
      this.db = new Database(dbPath);
      this.createTables();
      console.log('数据库初始化成功');
    } catch (error) {
      console.error('数据库初始化失败:', error);
      throw error;
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

    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO logs (id, filePath, timestamp, level, message, source, raw)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((logs) => {
      for (const log of logs) {
        insert.run(
          log.id,
          log.filePath,
          log.timestamp,
          log.level,
          log.message,
          log.source,
          log.raw
        );
      }
    });

    insertMany(logs);
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
    const params = [];

    if (level) {
      query += ' AND level = ?';
      params.push(level);
    }

    if (keyword) {
      query += ' AND message LIKE ?';
      params.push(`%${keyword}%`);
    }

    if (startDate) {
      query += ' AND timestamp >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND timestamp <= ?';
      params.push(endDate);
    }

    if (source) {
      query += ' AND source = ?';
      params.push(source);
    }

    if (filePath) {
      query += ' AND filePath LIKE ?';
      params.push(`%${filePath}%`);
    }

    query += ' ORDER BY timestamp DESC';
    query += ' LIMIT ? OFFSET ?';
    
    params.push(pageSize);
    params.push((page - 1) * pageSize);

    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  /**
   * 获取统计信息
   */
  getStatistics(options = {}) {
    if (!this.db) return {};

    const { startDate, endDate } = options;
    
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (startDate) {
      whereClause += ' AND timestamp >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND timestamp <= ?';
      params.push(endDate);
    }

    // 按级别统计
    const levelStats = this.db.prepare(`
      SELECT level, COUNT(*) as count
      FROM logs ${whereClause}
      GROUP BY level
      ORDER BY count DESC
    `).all(...params);

    // 按来源统计
    const sourceStats = this.db.prepare(`
      SELECT source, COUNT(*) as count
      FROM logs ${whereClause}
      GROUP BY source
      ORDER BY count DESC
      LIMIT 20
    `).all(...params);

    // 总数
    const total = this.db.prepare(`
      SELECT COUNT(*) as count FROM logs ${whereClause}
    `).get(...params);

    // 时间趋势（按小时）
    const timeTrend = this.db.prepare(`
      SELECT strftime('%Y-%m-%d %H:00', timestamp) as hour, COUNT(*) as count
      FROM logs ${whereClause}
      GROUP BY hour
      ORDER BY hour DESC
      LIMIT 48
    `).all(...params);

    return {
      total: total.count,
      byLevel: levelStats,
      bySource: sourceStats,
      timeTrend
    };
  }

  /**
   * 保存监控配置
   */
  saveMonitorConfig(config) {
    if (!this.db) return;

    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO monitor_configs 
      (id, name, paths, alertKeywords, customKeywords, status, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    insert.run(
      config.id,
      config.name,
      JSON.stringify(config.paths),
      JSON.stringify(config.alertKeywords || []),
      JSON.stringify(config.customKeywords || []),
      config.status || 'stopped'
    );
  }

  /**
   * 获取所有监控配置
   */
  getMonitorConfigs() {
    if (!this.db) return [];

    const stmt = this.db.prepare('SELECT * FROM monitor_configs ORDER BY createdAt DESC');
    const configs = stmt.all();

    return configs.map(config => ({
      ...config,
      paths: JSON.parse(config.paths),
      alertKeywords: JSON.parse(config.alertKeywords),
      customKeywords: JSON.parse(config.customKeywords)
    }));
  }

  /**
   * 保存告警记录
   */
  saveAlert(alert) {
    if (!this.db) return;

    const insert = this.db.prepare(`
      INSERT INTO alerts (id, monitorId, type, level, message, logId)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insert.run(
      alert.id,
      alert.monitorId,
      alert.type,
      alert.level,
      alert.message,
      alert.logId
    );
  }

  /**
   * 获取告警记录
   */
  getAlerts(options = {}) {
    if (!this.db) return [];

    const { page = 1, pageSize = 50, monitorId } = options;

    let query = 'SELECT * FROM alerts WHERE 1=1';
    const params = [];

    if (monitorId) {
      query += ' AND monitorId = ?';
      params.push(monitorId);
    }

    query += ' ORDER BY createdAt DESC';
    query += ' LIMIT ? OFFSET ?';
    
    params.push(pageSize);
    params.push((page - 1) * pageSize);

    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  /**
   * 关闭数据库
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

module.exports = DatabaseService;
