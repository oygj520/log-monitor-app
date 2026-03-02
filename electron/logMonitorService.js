const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// 性能优化配置
const CONFIG = {
  MAX_OPEN_FILES: 50, // 最大同时打开的文件数
  FILE_HANDLE_TIMEOUT: 30000, // 文件句柄超时时间 (ms)
  RETRY_MAX_ATTEMPTS: 3, // 文件锁定重试次数
  RETRY_DELAY: 100 // 重试延迟 (ms)
};

// 文件句柄管理器 - 限制同时打开的文件数量
class FileHandleManager {
  constructor() {
    this.openHandles = new Map(); // filePath -> { fd, timeout, lastUsed }
    this.queue = []; // 等待打开的文件队列
    this.isProcessing = false;
  }

  async openFile(filePath, flags = 'r') {
    // 如果已经有打开的句柄，更新使用时间
    if (this.openHandles.has(filePath)) {
      const handle = this.openHandles.get(filePath);
      clearTimeout(handle.timeout);
      handle.lastUsed = Date.now();
      this._setHandleTimeout(filePath, handle);
      return handle.fd;
    }

    // 如果超过最大文件数，等待
    if (this.openHandles.size >= CONFIG.MAX_OPEN_FILES) {
      return new Promise((resolve) => {
        this.queue.push({ filePath, flags, resolve });
        this._processQueue();
      });
    }

    return this._doOpenFile(filePath, flags);
  }

  async _doOpenFile(filePath, flags) {
    let lastError = null;
    
    // 文件锁定重试机制
    for (let attempt = 1; attempt <= CONFIG.RETRY_MAX_ATTEMPTS; attempt++) {
      try {
        const fd = fs.openSync(filePath, flags);
        const handle = {
          fd,
          lastUsed: Date.now(),
          timeout: null
        };
        
        this._setHandleTimeout(filePath, handle);
        this.openHandles.set(filePath, handle);
        
        return fd;
      } catch (error) {
        lastError = error;
        if (error.code === 'EBUSY' || error.code === 'EACCES') {
          console.log(`[文件句柄] 文件被锁定，重试 ${attempt}/${CONFIG.RETRY_MAX_ATTEMPTS}: ${filePath}`);
          await this._sleep(CONFIG.RETRY_DELAY * attempt);
        } else {
          break;
        }
      }
    }
    
    throw lastError || new Error(`无法打开文件：${filePath}`);
  }

  _setHandleTimeout(filePath, handle) {
    handle.timeout = setTimeout(() => {
      this.closeFile(filePath);
    }, CONFIG.FILE_HANDLE_TIMEOUT);
  }

  closeFile(filePath) {
    const handle = this.openHandles.get(filePath);
    if (handle) {
      clearTimeout(handle.timeout);
      try {
        fs.closeSync(handle.fd);
      } catch (error) {
        console.error(`[文件句柄] 关闭文件失败：${filePath}`, error);
      }
      this.openHandles.delete(filePath);
      this._processQueue();
    }
  }

  async _processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    
    this.isProcessing = true;
    
    while (this.queue.length > 0 && this.openHandles.size < CONFIG.MAX_OPEN_FILES) {
      const item = this.queue.shift();
      try {
        const fd = await this._doOpenFile(item.filePath, item.flags);
        item.resolve(fd);
      } catch (error) {
        item.reject(error);
      }
    }
    
    this.isProcessing = false;
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  closeAll() {
    for (const [filePath, handle] of this.openHandles) {
      clearTimeout(handle.timeout);
      try {
        fs.closeSync(handle.fd);
      } catch (error) {
        console.error(`[文件句柄] 关闭文件失败：${filePath}`, error);
      }
    }
    this.openHandles.clear();
    this.queue = [];
  }

  getStats() {
    return {
      openCount: this.openHandles.size,
      queueLength: this.queue.length,
      maxFiles: CONFIG.MAX_OPEN_FILES
    };
  }
}

class LogMonitorService {
  constructor(databaseService) {
    this.databaseService = databaseService;
    this.monitors = new Map();
    this.fileWatchers = new Map();
    this.filePositions = new Map();
    // 4. 文件句柄管理：添加文件句柄管理器
    this.fileHandleManager = new FileHandleManager();
  }

  async startMonitoring(config) {
    const id = uuidv4();
    const monitorConfig = {
      id,
      ...config,
      status: 'running',
      startTime: new Date().toISOString()
    };

    try {
      console.log(`[监控服务] 开始监控任务 ${id}, 路径：`, config.paths);

      const watcher = chokidar.watch(config.paths, {
        ignored: /(^|[\/\\])\../,
        persistent: true,
        ignoreInitial: false,
        awaitWriteFinish: {
          stabilityThreshold: 500,
          pollInterval: 100
        },
        usePolling: true,
        interval: 1000
      });

      watcher.on('add', (filePath) => {
        console.log(`[监控服务] 新文件：${filePath}`);
        this.processLogFile(filePath, monitorConfig, false);
      });

      watcher.on('change', (filePath) => {
        console.log(`[监控服务] 文件变化：${filePath}`);
        this.processLogFile(filePath, monitorConfig, true);
      });

      watcher.on('error', (error) => {
        console.error(`[监控服务] 监控错误：${error}`);
        this.emitAlert(monitorConfig.id, 'error', error.message);
      });

      this.fileWatchers.set(id, watcher);
      this.monitors.set(id, monitorConfig);

      this.emitStatusChange();

      return { success: true, id, message: '监控已启动' };
    } catch (error) {
      console.error('[监控服务] 启动监控失败:', error);
      return { success: false, error: error.message };
    }
  }

  async stopMonitoring(id) {
    const watcher = this.fileWatchers.get(id);
    if (watcher) {
      await watcher.close();
      this.fileWatchers.delete(id);
    }

    const monitor = this.monitors.get(id);
    if (monitor) {
      monitor.status = 'stopped';
      monitor.stopTime = new Date().toISOString();
      this.monitors.set(id, monitor);
    }

    this.emitStatusChange();
    return { success: true, message: '监控已停止' };
  }

  stopAll() {
    for (const [id, watcher] of this.fileWatchers) {
      watcher.close();
    }
    this.fileWatchers.clear();
    this.monitors.clear();
    this.filePositions.clear();
    // 4. 文件句柄管理：关闭所有文件句柄
    this.fileHandleManager.closeAll();
  }

  getStatus() {
    const status = [];
    for (const [id, config] of this.monitors) {
      status.push({
        id,
        paths: config.paths,
        status: config.status,
        startTime: config.startTime,
        stopTime: config.stopTime,
        logCount: config.logCount || 0
      });
    }
    return status;
  }

  /**
   * 3. 后端过滤：从数据库获取日志时应用过滤条件
   */
  async getLogs(options = {}) {
    const { page = 1, pageSize = 100, level, keyword, startDate, endDate, source } = options;
    
    try {
      // 调用数据库服务的过滤查询
      const result = await this.databaseService.getLogs({
        page,
        pageSize,
        level: level || undefined,
        keyword: keyword || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        source: source || undefined
      });
      
      return result;
    } catch (error) {
      console.error('[监控服务] 获取日志失败:', error);
      return [];
    }
  }

  async processLogFile(filePath, monitorConfig, isUpdate = false) {
    let fd = null;
    
    try {
      const stats = fs.statSync(filePath);
      
      const fileKey = `${stats.dev}:${stats.ino}`;
      const storedPosition = this.filePositions.get(fileKey);
      
      let startPosition = 0;
      let isNewFile = false;
      
      if (!storedPosition || storedPosition.ino !== stats.ino) {
        console.log(`[监控服务] 新文件或文件重置：${filePath}`);
        isNewFile = true;
        startPosition = 0;
      } else {
        startPosition = storedPosition.position;
      }
      
      if (stats.size < startPosition) {
        console.log(`[监控服务] 文件被截断，重新读取：${filePath}`);
        startPosition = 0;
      }
      
      if (stats.size === startPosition && isUpdate) {
        console.log(`[监控服务] 文件无新内容：${filePath}`);
        return;
      }
      
      // 4. 文件句柄管理：使用文件句柄管理器打开文件
      fd = await this.fileHandleManager.openFile(filePath, 'r');
      
      const buffer = Buffer.alloc(stats.size - startPosition);
      await fs.readSync(fd, buffer, 0, stats.size - startPosition, startPosition);
      
      // 更新文件位置
      this.filePositions.set(fileKey, {
        position: stats.size,
        inode: stats.ino,
        filePath
      });
      
      const newContent = buffer.toString('utf-8');
      const lines = newContent.split('\n');
      let newLogs = [];

      for (const line of lines) {
        if (!line.trim()) continue;
        
        const parsed = this.parseLogLine(line, filePath);
        if (parsed) {
          newLogs.push(parsed);
        }
      }

      if (newLogs.length > 0) {
        console.log(`[监控服务] 解析到 ${newLogs.length} 条新日志`);
        await this.databaseService.saveLogs(newLogs);
        monitorConfig.logCount = (monitorConfig.logCount || 0) + newLogs.length;
        
        this.checkAlerts(newLogs, monitorConfig);
        this.emitLogUpdate(newLogs);
      } else {
        console.log(`[监控服务] 未解析到有效日志：${filePath}`);
      }

    } catch (error) {
      console.error(`[监控服务] 处理文件 ${filePath} 失败:`, error);
    } finally {
      // 4. 文件句柄管理：使用完后关闭文件句柄（实际由管理器控制超时）
      if (fd !== null && filePath) {
        // 不立即关闭，由管理器控制超时
        // this.fileHandleManager.closeFile(filePath);
      }
    }
  }

  parseLogLine(line, filePath) {
    const log = {
      id: uuidv4(),
      filePath,
      raw: line,
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: line,
      source: path.basename(filePath)
    };

    const errorPatterns = [
      /(Exception|Error|Throwable):\s*/i,
      /Traceback \(most recent call last\)/,
      /\s+at\s+[\w\.]+\(/,
      /Caused by:/,
      /Exception in thread/,
      /\s+File\s+"[^"]+",\s+line\s+\d+/
    ];

    const isError = errorPatterns.some(pattern => pattern.test(line));
    if (isError) {
      log.level = 'ERROR';
      return log;
    }

    const format1 = line.match(/^\[(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\]\s+\[(\w+)\]\s+(.*)$/);
    if (format1) {
      log.timestamp = format1[1];
      log.level = format1[2].toUpperCase();
      log.message = format1[3];
      return log;
    }

    const format2 = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z?)\s+(\w+)\s+(.*)$/);
    if (format2) {
      log.timestamp = format2[1];
      log.level = format2[2].toUpperCase();
      log.message = format2[3];
      return log;
    }

    const format3 = line.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(\w+)\s+(.*)$/);
    if (format3) {
      log.timestamp = format3[1];
      log.level = format3[2].toUpperCase();
      log.message = format3[3];
      return log;
    }

    try {
      const jsonLog = JSON.parse(line);
      if (jsonLog.timestamp || jsonLog.time || jsonLog.date) {
        log.timestamp = jsonLog.timestamp || jsonLog.time || jsonLog.date;
        log.level = (jsonLog.level || jsonLog.severity || 'INFO').toUpperCase();
        log.message = jsonLog.message || jsonLog.msg || line;
        return log;
      }
    } catch (e) {
      // 不是 JSON 格式
    }

    return log;
  }

  checkAlerts(logs, monitorConfig) {
    const alertKeywords = monitorConfig.alertKeywords || ['ERROR', 'FATAL', 'CRITICAL'];
    
    for (const log of logs) {
      if (alertKeywords.includes(log.level)) {
        this.emitAlert(monitorConfig.id, 'level', log);
      }

      if (monitorConfig.keywords) {
        for (const keyword of monitorConfig.keywords) {
          if (log.message.includes(keyword)) {
            this.emitAlert(monitorConfig.id, 'keyword', { ...log, keyword });
          }
        }
      }
    }
  }

  emitAlert(monitorId, type, data) {
    console.log(`[监控服务] 告警 [${monitorId}]: ${type}`, data);
    try {
      const { BrowserWindow } = require('electron');
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        windows[0].webContents.send('alert', {
          monitorId,
          type,
          data,
          createdAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('[监控服务] 发送告警失败:', error);
    }
  }

  emitLogUpdate(logs) {
    console.log(`[监控服务] 发送 ${logs.length} 条日志更新到前端`);
    try {
      const { BrowserWindow } = require('electron');
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        windows[0].webContents.send('log-update', {
          logs,
          count: logs.length,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('[监控服务] 发送日志更新失败:', error);
    }
  }

  emitStatusChange() {
    console.log('[监控服务] 监控状态变化');
    try {
      const { BrowserWindow } = require('electron');
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        windows[0].webContents.send('monitoring-status-change', {
          ...this.getStatus(),
          fileHandleStats: this.fileHandleManager.getStats()
        });
      }
    } catch (error) {
      console.error('[监控服务] 发送状态变化失败:', error);
    }
  }
}

module.exports = LogMonitorService;
