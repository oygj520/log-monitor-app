const initSqlJs = require('sql.js');
const PathManager = require('./pathManager');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const crypto = require('crypto');

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
    console.log('[DatabaseService] 开始初始化数据库...');
    
    // 详细路径检查
    console.log('[DatabaseService] PathManager.dataPath:', PathManager.dataPath);
    console.log('[DatabaseService] PathManager.databasePath:', PathManager.databasePath);
    
    this.dbPath = PathManager.getDatabasePath();
    console.log('[DatabaseService] PathManager.getDatabasePath() 返回值:', this.dbPath);
    
    // null 检查
    if (!this.dbPath) {
      console.error('[DatabaseService] ❌ 严重错误：dbPath 为 null');
      console.error('[DatabaseService] PathManager.databasePath:', PathManager.databasePath);
      throw new Error('数据库路径为 null，PathManager 可能未正确初始化');
    }
    
    // 验证路径有效性
    const dbDir = path.dirname(this.dbPath);
    console.log('[DatabaseService] 数据库目录:', dbDir);
    
    if (!fs.existsSync(dbDir)) {
      console.log('[DatabaseService] 数据库目录不存在，尝试创建...');
      try {
        fs.mkdirSync(dbDir, { recursive: true });
        console.log('[DatabaseService] ✅ 数据库目录创建成功');
      } catch (e) {
        console.error('[DatabaseService] ❌ 创建数据库目录失败:', e.message);
        throw e;
      }
    }
    
    try {
      // 初始化 sql.js - 增加内存限制防止 WASM 内存耗尽
      console.log('[DatabaseService] 初始化 sql.js (heapSize: 256MB, stackSize: 16MB)...');
      const wasmPath = path.join(__dirname, 'sql-wasm.wasm');
      console.log('[DatabaseService] WASM 文件路径:', wasmPath);
      
      // 检查 WASM 文件是否存在
      if (!fs.existsSync(wasmPath)) {
        console.error('[DatabaseService] ❌ WASM 文件不存在:', wasmPath);
        throw new Error('WASM 文件不存在：' + wasmPath);
      }
      
      // 读取 WASM 文件为 Buffer
      console.log('[DatabaseService] 读取 WASM 文件...');
      const wasmBuffer = fs.readFileSync(wasmPath);
      console.log('[DatabaseService] WASM 文件大小:', wasmBuffer.length, 'bytes');
      
      // 使用 wasmBinary 选项直接传递 WASM 数据
      this.SQL = await initSqlJs({
        wasmBinary: wasmBuffer,
        heapSize: 256 * 1024 * 1024,  // 256MB 堆内存
        stackSize: 16 * 1024 * 1024    // 16MB 栈内存
      });
      console.log('[DatabaseService] ✅ sql.js 初始化完成');
      
      // 启动内存监控
      this.startMemoryMonitoring();
      
      // 启动定期 VACUUM 清理
      this.startVacuumCleanup();
      
      // 检查数据库文件是否存在
      if (fs.existsSync(this.dbPath)) {
        console.log('[DatabaseService] 数据库文件存在，加载现有数据库...');
        const fileBuffer = fs.readFileSync(this.dbPath);
        console.log('[DatabaseService] 数据库文件大小:', fileBuffer.length, 'bytes');
        this.db = new this.SQL.Database(fileBuffer);
        console.log('[DatabaseService] ✅ 加载现有数据库成功');
      } else {
        console.log('[DatabaseService] 数据库文件不存在，创建新数据库...');
        this.db = new this.SQL.Database();
        this.createTables();
        this.saveDatabase();
        console.log('[DatabaseService] ✅ 创建新数据库成功');
      }
      
      console.log('[DatabaseService] 🎉 数据库初始化全部完成');
    } catch (error) {
      console.error('[DatabaseService] ❌ 数据库初始化失败:', error.message);
      console.error('[DatabaseService] ❌ 堆栈:', error.stack);
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

    // 归档元数据表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS archive_metadata (
        id TEXT PRIMARY KEY,
        originalCount INTEGER NOT NULL,
        startDate TEXT NOT NULL,
        endDate TEXT NOT NULL,
        archivePath TEXT NOT NULL,
        compressedSize INTEGER NOT NULL,
        originalSize INTEGER NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        checksum TEXT
      )
    `);

    // 增量查询状态表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS query_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 初始化增量查询状态
    this.db.exec(`
      INSERT OR IGNORE INTO query_state (key, value) VALUES ('last_log_timestamp', '1970-01-01 00:00:00')
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
   * 查询日志（支持后端过滤和分页）
   */
  getLogs(options = {}) {
    if (!this.db) return { logs: [], total: 0 };

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

    // 构建 WHERE 子句
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

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // 获取总数
    const countQuery = `SELECT COUNT(*) as count FROM logs ${whereClause}`;
    const countStmt = this.db.prepare(countQuery);
    const total = countStmt.step() ? countStmt.getAsObject().count : 0;
    countStmt.free();

    // 获取分页数据
    const dataQuery = `SELECT * FROM logs ${whereClause} ORDER BY timestamp DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
    const stmt = this.db.prepare(dataQuery);
    const results = [];
    
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();

    // 3. 后端过滤：返回过滤后的数据和总数
    return { logs: results, total };
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
   * 增量查询日志（只查询新增的日志）
   */
  getIncrementalLogs(options = {}) {
    if (!this.db) return { logs: [], hasMore: false };

    const {
      lastTimestamp = null,
      pageSize = 100,
      monitorId = null
    } = options;

    // 如果没有指定时间戳，从状态表获取
    let queryTimestamp = lastTimestamp;
    if (!queryTimestamp) {
      const stmt = this.db.prepare("SELECT value FROM query_state WHERE key = 'last_log_timestamp'");
      if (stmt.step()) {
        queryTimestamp = stmt.getAsObject().value;
      }
      stmt.free();
    }

    let query = 'SELECT * FROM logs WHERE timestamp > ?';
    const params = [queryTimestamp];

    if (monitorId) {
      query += ' AND source = ?';
      params.push(monitorId);
    }

    query += ' ORDER BY timestamp ASC';
    query += ` LIMIT ${pageSize}`;

    const stmt = this.db.prepare(query);
    stmt.bind(params);
    
    const logs = [];
    let maxTimestamp = queryTimestamp;
    
    while (stmt.step()) {
      const row = stmt.getAsObject();
      logs.push(row);
      if (row.timestamp > maxTimestamp) {
        maxTimestamp = row.timestamp;
      }
    }
    stmt.free();

    // 更新最后查询时间戳
    if (logs.length > 0) {
      this.updateQueryState('last_log_timestamp', maxTimestamp);
    }

    // 检查是否还有更多数据
    const countQuery = 'SELECT COUNT(*) as count FROM logs WHERE timestamp > ?';
    const countStmt = this.db.prepare(countQuery);
    countStmt.bind([maxTimestamp]);
    let hasMore = false;
    if (countStmt.step()) {
      hasMore = countStmt.getAsObject().count > 0;
    }
    countStmt.free();

    return { logs, hasMore, lastTimestamp: maxTimestamp };
  }

  /**
   * 更新查询状态
   */
  updateQueryState(key, value) {
    if (!this.db) return;

    try {
      this.db.exec(`
        INSERT OR REPLACE INTO query_state (key, value, updatedAt)
        VALUES ('${key}', '${value}', CURRENT_TIMESTAMP)
      `);
      this.saveDatabase();
    } catch (error) {
      console.error('更新查询状态失败:', error);
    }
  }

  /**
   * 获取查询状态
   */
  getQueryState(key) {
    if (!this.db) return null;

    const stmt = this.db.prepare(`SELECT value FROM query_state WHERE key = '${key}'`);
    let value = null;
    if (stmt.step()) {
      value = stmt.getAsObject().value;
    }
    stmt.free();
    return value;
  }

  /**
   * 归档旧日志（超过指定天数的日志）
   */
  async archiveOldLogs(daysToKeep = 7) {
    if (!this.db) return { success: false, error: '数据库未初始化' };

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0] + ' 00:00:00';

      console.log(`[归档服务] 开始归档 ${cutoffDateStr} 之前的日志`);

      // 查询需要归档的日志
      const archiveQuery = `SELECT * FROM logs WHERE timestamp < '${cutoffDateStr}' ORDER BY timestamp`;
      const logsToArchive = this.executeQuery(archiveQuery);

      if (logsToArchive.length === 0) {
        console.log('[归档服务] 没有需要归档的日志');
        return { success: true, archived: 0, message: '没有需要归档的日志' };
      }

      console.log(`[归档服务] 找到 ${logsToArchive.length} 条日志需要归档`);

      // 创建归档文件
      const archiveResult = await this.createArchiveFile(logsToArchive, cutoffDateStr);

      if (!archiveResult.success) {
        return archiveResult;
      }

      // 从数据库中删除已归档的日志
      this.db.exec(`DELETE FROM logs WHERE timestamp < '${cutoffDateStr}'`);
      this.saveDatabase();

      // 保存归档元数据
      this.saveArchiveMetadata({
        id: archiveResult.archiveId,
        originalCount: logsToArchive.length,
        startDate: logsToArchive[0]?.timestamp || cutoffDateStr,
        endDate: logsToArchive[logsToArchive.length - 1]?.timestamp || cutoffDateStr,
        archivePath: archiveResult.archivePath,
        compressedSize: archiveResult.compressedSize,
        originalSize: archiveResult.originalSize,
        checksum: archiveResult.checksum
      });

      console.log(`[归档服务] 归档完成：${logsToArchive.length} 条日志，压缩比：${((archiveResult.compressedSize / archiveResult.originalSize) * 100).toFixed(2)}%`);

      return {
        success: true,
        archived: logsToArchive.length,
        archivePath: archiveResult.archivePath,
        compressedSize: archiveResult.compressedSize,
        originalSize: archiveResult.originalSize
      };
    } catch (error) {
      console.error('[归档服务] 归档失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 创建归档文件
   */
  async createArchiveFile(logs, cutoffDateStr) {
    try {
      console.log('[DatabaseService] 开始创建归档文件...');
      
      const dataPath = PathManager.getDataPath();
      console.log('[DatabaseService] PathManager.getDataPath():', dataPath);
      if (!dataPath) {
        console.error('[DatabaseService] ❌ PathManager.getDataPath() 返回 null');
        console.error('[DatabaseService] PathManager.dataPath:', PathManager.dataPath);
        throw new Error('PathManager.getDataPath() 返回 null');
      }
      
      const archiveDir = PathManager.getArchivesPath();
      console.log('[DatabaseService] PathManager.getArchivesPath():', archiveDir);
      
      if (!archiveDir) {
        console.error('[DatabaseService] ❌ PathManager.getArchivesPath() 返回 null');
        console.error('[DatabaseService] PathManager.archivesPath:', PathManager.archivesPath);
        throw new Error('PathManager.getArchivesPath() 返回 null');
      }
      
      // 确保归档目录存在
      if (!fs.existsSync(archiveDir)) {
        console.log('[DatabaseService] 归档目录不存在，尝试创建...');
        fs.mkdirSync(archiveDir, { recursive: true });
        console.log('[DatabaseService] ✅ 归档目录创建成功:', archiveDir);
      } else {
        console.log('[DatabaseService] ✅ 归档目录已存在:', archiveDir);
      }

      // 生成归档文件名
      const dateStr = cutoffDateStr.split(' ')[0].replace(/-/g, '');
      const timestamp = Date.now();
      const archiveId = `archive_${dateStr}_${timestamp}`;
      const archivePath = path.join(archiveDir, `${archiveId}.json.gz`);
      console.log('[DatabaseService] 归档文件完整路径:', archivePath);

      // 序列化日志数据
      console.log('[DatabaseService] 序列化', logs.length, '条日志...');
      const jsonData = JSON.stringify(logs, null, 2);
      const originalSize = Buffer.byteLength(jsonData, 'utf-8');
      console.log('[DatabaseService] 原始数据大小:', originalSize, 'bytes');

      // 压缩数据
      console.log('[DatabaseService] 压缩数据...');
      const compressed = zlib.gzipSync(Buffer.from(jsonData));
      const compressedSize = compressed.length;
      console.log('[DatabaseService] 压缩后大小:', compressedSize, 'bytes');

      // 写入归档文件
      console.log('[DatabaseService] 写入文件:', archivePath);
      fs.writeFileSync(archivePath, compressed);
      console.log('[DatabaseService] ✅ 文件写入成功');

      // 计算校验和
      const checksum = crypto.createHash('md5').update(compressed).digest('hex');
      console.log('[DatabaseService] 校验和:', checksum);

      console.log(`[归档服务] ✅ 归档文件创建完成：${archivePath}`);

      return {
        success: true,
        archiveId,
        archivePath,
        compressedSize,
        originalSize,
        checksum
      };
    } catch (error) {
      console.error('[归档服务] ❌ 创建归档文件失败:', error.message);
      console.error('[归档服务] ❌ 堆栈:', error.stack);
      return { success: false, error: error.message };
    }
  }

  /**
   * 保存归档元数据
   */
  saveArchiveMetadata(metadata) {
    if (!this.db) return;

    try {
      this.db.exec(`
        INSERT INTO archive_metadata 
        (id, originalCount, startDate, endDate, archivePath, compressedSize, originalSize, checksum)
        VALUES ('${metadata.id}', ${metadata.originalCount}, '${metadata.startDate}', '${metadata.endDate}', '${metadata.archivePath}', ${metadata.compressedSize}, ${metadata.originalSize}, '${metadata.checksum}')
      `);
      this.saveDatabase();
    } catch (error) {
      console.error('保存归档元数据失败:', error);
    }
  }

  /**
   * 获取归档列表
   */
  getArchiveList() {
    if (!this.db) return [];

    const query = 'SELECT * FROM archive_metadata ORDER BY createdAt DESC';
    return this.executeQuery(query);
  }

  /**
   * 查询归档日志
   */
  queryArchiveLogs(archiveId, options = {}) {
    try {
      // 获取归档元数据
      const metadataStmt = this.db.prepare(`SELECT * FROM archive_metadata WHERE id = '${archiveId}'`);
      let metadata = null;
      if (metadataStmt.step()) {
        metadata = metadataStmt.getAsObject();
      }
      metadataStmt.free();

      if (!metadata) {
        return { success: false, error: '归档不存在' };
      }

      // 读取并解压归档文件
      if (!fs.existsSync(metadata.archivePath)) {
        return { success: false, error: '归档文件不存在' };
      }

      const compressed = fs.readFileSync(metadata.archivePath);
      const decompressed = zlib.gunzipSync(compressed);
      const logs = JSON.parse(decompressed.toString('utf-8'));

      // 应用过滤条件
      let filteredLogs = logs;
      const { level, keyword, page = 1, pageSize = 100 } = options;

      if (level) {
        filteredLogs = filteredLogs.filter(log => log.level === level);
      }

      if (keyword) {
        filteredLogs = filteredLogs.filter(log => 
          log.message && log.message.toLowerCase().includes(keyword.toLowerCase())
        );
      }

      // 分页
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

      return {
        success: true,
        logs: paginatedLogs,
        total: filteredLogs.length,
        page,
        pageSize,
        metadata: {
          id: metadata.id,
          startDate: metadata.startDate,
          endDate: metadata.endDate,
          originalCount: metadata.originalCount,
          compressedSize: metadata.compressedSize,
          createdAt: metadata.createdAt
        }
      };
    } catch (error) {
      console.error('[归档服务] 查询归档日志失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 删除归档
   */
  deleteArchive(archiveId) {
    try {
      // 获取归档元数据
      const metadataStmt = this.db.prepare(`SELECT * FROM archive_metadata WHERE id = '${archiveId}'`);
      let metadata = null;
      if (metadataStmt.step()) {
        metadata = metadataStmt.getAsObject();
      }
      metadataStmt.free();

      if (!metadata) {
        return { success: false, error: '归档不存在' };
      }

      // 删除归档文件
      if (fs.existsSync(metadata.archivePath)) {
        fs.unlinkSync(metadata.archivePath);
      }

      // 删除元数据
      this.db.exec(`DELETE FROM archive_metadata WHERE id = '${archiveId}'`);
      this.saveDatabase();

      console.log(`[归档服务] 删除归档：${archiveId}`);
      return { success: true };
    } catch (error) {
      console.error('[归档服务] 删除归档失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取归档统计信息
   */
  getArchiveStatistics() {
    if (!this.db) return { totalArchives: 0, totalLogs: 0, totalCompressedSize: 0 };

    const statsQuery = `
      SELECT 
        COUNT(*) as totalArchives,
        SUM(originalCount) as totalLogs,
        SUM(compressedSize) as totalCompressedSize,
        SUM(originalSize) as totalOriginalSize
      FROM archive_metadata
    `;
    
    const stmt = this.db.prepare(statsQuery);
    let stats = { totalArchives: 0, totalLogs: 0, totalCompressedSize: 0, totalOriginalSize: 0 };
    if (stmt.step()) {
      stats = stmt.getAsObject();
    }
    stmt.free();

    // 计算压缩比
    if (stats.totalOriginalSize > 0) {
      stats.compressionRatio = ((stats.totalCompressedSize / stats.totalOriginalSize) * 100).toFixed(2) + '%';
    }

    return stats;
  }

  /**
   * 启动内存监控 - 防止 WASM 内存耗尽
   */
  startMemoryMonitoring() {
    console.log('[DatabaseService] 启动内存监控 (每 60 秒检查一次)...');
    
    this.memoryMonitorInterval = setInterval(() => {
      if (!this.db || !this.SQL) {
        console.log('[DatabaseService] 数据库未初始化，跳过内存检查');
        return;
      }
      
      try {
        const memSize = this.db.getHeapSize();
        const maxMem = this.db.getHeapMax();
        const usagePercent = (memSize / maxMem) * 100;
        
        console.log(`[DatabaseService] 内存使用：${(memSize / 1024 / 1024).toFixed(2)}MB / ${(maxMem / 1024 / 1024).toFixed(2)}MB (${usagePercent.toFixed(1)}%)`);
        
        // 内存使用超过 80% 时警告并准备重启
        if (usagePercent > 80) {
          console.warn(`[DatabaseService] ⚠️ 内存使用超过 80%，准备重启数据库...`);
          this.restartDatabase();
        }
      } catch (error) {
        console.error('[DatabaseService] 内存检查失败:', error.message);
      }
    }, 60000); // 每 60 秒检查一次
    
    // 设置不干扰事件循环
    if (this.memoryMonitorInterval.unref) {
      this.memoryMonitorInterval.unref();
    }
  }
  
  /**
   * 重启数据库 - 释放内存
   */
  async restartDatabase() {
    console.log('[DatabaseService] 开始重启数据库...');
    
    try {
      // 停止监控
      if (this.memoryMonitorInterval) {
        clearInterval(this.memoryMonitorInterval);
        this.memoryMonitorInterval = null;
      }
      
      if (this.vacuumInterval) {
        clearInterval(this.vacuumInterval);
        this.vacuumInterval = null;
      }
      
      // 保存当前数据
      if (this.db) {
        this.saveDatabase();
        this.db.close();
        this.db = null;
      }
      
      // 重新初始化
      console.log('[DatabaseService] 重新初始化 sql.js...');
      const wasmPath = path.join(__dirname, 'sql-wasm.wasm');
      console.log('[DatabaseService] WASM 文件路径:', wasmPath);
      
      // 读取 WASM 文件为 Buffer
      const wasmBuffer = fs.readFileSync(wasmPath);
      console.log('[DatabaseService] WASM 文件大小:', wasmBuffer.length, 'bytes');
      
      // 使用 wasmBinary 选项直接传递 WASM 数据
      this.SQL = await initSqlJs({
        wasmBinary: wasmBuffer,
        heapSize: 256 * 1024 * 1024,
        stackSize: 16 * 1024 * 1024
      });
      
      // 加载现有数据库
      if (fs.existsSync(this.dbPath)) {
        const fileBuffer = fs.readFileSync(this.dbPath);
        this.db = new this.SQL.Database(fileBuffer);
        console.log('[DatabaseService] ✅ 数据库重启完成，已加载现有数据');
      } else {
        this.db = new this.SQL.Database();
        this.createTables();
        this.saveDatabase();
        console.log('[DatabaseService] ✅ 数据库重启完成，创建新数据库');
      }
      
      // 重新启动监控
      this.startMemoryMonitoring();
      this.startVacuumCleanup();
      
      console.log('[DatabaseService] 🎉 数据库重启成功');
    } catch (error) {
      console.error('[DatabaseService] ❌ 数据库重启失败:', error.message);
      console.error('[DatabaseService] ❌ 堆栈:', error.stack);
      // 重启失败后尝试重新初始化
      setTimeout(() => this.initialize(), 5000);
    }
  }
  
  /**
   * 启动定期 VACUUM 清理 - 回收未使用的空间
   */
  startVacuumCleanup() {
    console.log('[DatabaseService] 启动定期 VACUUM 清理 (每 300 秒执行一次)...');
    
    this.vacuumInterval = setInterval(() => {
      if (!this.db) {
        return;
      }
      
      try {
        console.log('[DatabaseService] 执行 VACUUM 清理...');
        this.db.exec('VACUUM');
        console.log('[DatabaseService] ✅ VACUUM 清理完成');
      } catch (error) {
        console.error('[DatabaseService] VACUUM 清理失败:', error.message);
      }
    }, 300000); // 每 5 分钟执行一次
    
    // 设置不干扰事件循环
    if (this.vacuumInterval.unref) {
      this.vacuumInterval.unref();
    }
  }
  
  /**
   * 关闭数据库
   */
  close() {
    // 停止内存监控
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
      this.memoryMonitorInterval = null;
    }
    
    // 停止 VACUUM 清理
    if (this.vacuumInterval) {
      clearInterval(this.vacuumInterval);
      this.vacuumInterval = null;
    }
    
    if (this.db) {
      this.saveDatabase();
      this.db.close();
      this.db = null;
      this.SQL = null;
    }
  }
}

module.exports = DatabaseService;
