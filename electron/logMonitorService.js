const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class LogMonitorService {
  constructor(databaseService) {
    this.databaseService = databaseService;
    this.monitors = new Map(); // 存储所有监控器
    this.fileWatchers = new Map(); // 存储文件监听器
    this.filePositions = new Map(); // 存储每个文件的读取位置 { filePath: { position, inode } }
  }

  /**
   * 开始监控日志文件
   */
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

      // 创建文件监听器
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

      // 处理新文件
      watcher.on('add', (filePath) => {
        console.log(`[监控服务] 新文件：${filePath}`);
        this.processLogFile(filePath, monitorConfig, false);
      });

      // 处理文件变化
      watcher.on('change', (filePath) => {
        console.log(`[监控服务] 文件变化：${filePath}`);
        this.processLogFile(filePath, monitorConfig, true);
      });

      // 处理错误
      watcher.on('error', (error) => {
        console.error(`[监控服务] 监控错误：${error}`);
        this.emitAlert(monitorConfig.id, 'error', error.message);
      });

      this.fileWatchers.set(id, watcher);
      this.monitors.set(id, monitorConfig);

      // 通知状态变化
      this.emitStatusChange();

      return { success: true, id, message: '监控已启动' };
    } catch (error) {
      console.error('[监控服务] 启动监控失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 停止监控
   */
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

  /**
   * 停止所有监控
   */
  stopAll() {
    for (const [id, watcher] of this.fileWatchers) {
      watcher.close();
    }
    this.fileWatchers.clear();
    this.monitors.clear();
    this.filePositions.clear();
  }

  /**
   * 获取监控状态
   */
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
   * 处理日志文件（增量读取）
   */
  async processLogFile(filePath, monitorConfig, isUpdate = false) {
    try {
      const stats = fs.statSync(filePath);
      
      // 获取文件唯一标识（inode 或 dev+size）
      const fileKey = `${stats.dev}:${stats.ino}`;
      const storedPosition = this.filePositions.get(fileKey);
      
      let startPosition = 0;
      let isNewFile = false;
      
      // 检查是否是新文件或文件被重置
      if (!storedPosition || storedPosition.ino !== stats.ino) {
        console.log(`[监控服务] 新文件或文件重置：${filePath}`);
        isNewFile = true;
        startPosition = 0;
      } else {
        startPosition = storedPosition.position;
      }
      
      // 如果文件变小了，说明被截断了，从头开始
      if (stats.size < startPosition) {
        console.log(`[监控服务] 文件被截断，重新读取：${filePath}`);
        startPosition = 0;
      }
      
      // 如果没有新内容，跳过
      if (stats.size === startPosition && isUpdate) {
        console.log(`[监控服务] 文件无新内容：${filePath}`);
        return;
      }
      
      // 读取新内容
      const buffer = Buffer.alloc(stats.size - startPosition);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, buffer, 0, stats.size - startPosition, startPosition);
      fs.closeSync(fd);
      
      const newContent = buffer.toString('utf-8');
      
      // 更新文件位置
      this.filePositions.set(fileKey, {
        position: stats.size,
        inode: stats.ino,
        filePath
      });
      
      // 解析日志行
      const lines = newContent.split('\n');
      let newLogs = [];

      for (const line of lines) {
        if (!line.trim()) continue;
        
        const parsed = this.parseLogLine(line, filePath);
        if (parsed) {
          newLogs.push(parsed);
        }
      }

      // 保存到数据库
      if (newLogs.length > 0) {
        console.log(`[监控服务] 解析到 ${newLogs.length} 条新日志`);
        await this.databaseService.saveLogs(newLogs);
        monitorConfig.logCount = (monitorConfig.logCount || 0) + newLogs.length;
        
        // 检查告警
        this.checkAlerts(newLogs, monitorConfig);
        
        // 发送日志更新通知到前端
        this.emitLogUpdate(newLogs);
      } else {
        console.log(`[监控服务] 未解析到有效日志：${filePath}`);
      }

    } catch (error) {
      console.error(`[监控服务] 处理文件 ${filePath} 失败:`, error);
    }
  }

  /**
   * 解析日志行
   * 自动识别常见日志格式
   */
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

    // 尝试解析常见日志格式
    
    // 格式 1: [2024-01-01 12:00:00] [ERROR] message
    const format1 = line.match(/^\[(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\]\s+\[(\w+)\]\s+(.*)$/);
    if (format1) {
      log.timestamp = format1[1];
      log.level = format1[2].toUpperCase();
      log.message = format1[3];
      return log;
    }

    // 格式 2: 2024-01-01T12:00:00.000Z ERROR message
    const format2 = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z?)\s+(\w+)\s+(.*)$/);
    if (format2) {
      log.timestamp = format2[1];
      log.level = format2[2].toUpperCase();
      log.message = format2[3];
      return log;
    }

    // 格式 3: 2024-01-01 12:00:00 ERROR message
    const format3 = line.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(\w+)\s+(.*)$/);
    if (format3) {
      log.timestamp = format3[1];
      log.level = format3[2].toUpperCase();
      log.message = format3[3];
      return log;
    }

    // 格式 4: JSON 格式
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

  /**
   * 检查告警条件
   */
  checkAlerts(logs, monitorConfig) {
    const alertKeywords = monitorConfig.alertKeywords || ['ERROR', 'FATAL', 'CRITICAL'];
    
    for (const log of logs) {
      // 检查日志级别
      if (alertKeywords.includes(log.level)) {
        this.emitAlert(monitorConfig.id, 'level', log);
      }

      // 检查关键字
      if (monitorConfig.keywords) {
        for (const keyword of monitorConfig.keywords) {
          if (log.message.includes(keyword)) {
            this.emitAlert(monitorConfig.id, 'keyword', { ...log, keyword });
          }
        }
      }
    }
  }

  /**
   * 发送告警
   */
  emitAlert(monitorId, type, data) {
    console.log(`[监控服务] 告警 [${monitorId}]: ${type}`, data);
    // 通过 IPC 发送告警到前端
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

  /**
   * 发送日志更新通知
   */
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

  /**
   * 发送状态变化通知
   */
  emitStatusChange() {
    console.log('[监控服务] 监控状态变化');
    try {
      const { BrowserWindow } = require('electron');
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        windows[0].webContents.send('monitoring-status-change', this.getStatus());
      }
    } catch (error) {
      console.error('[监控服务] 发送状态变化失败:', error);
    }
  }
}

module.exports = LogMonitorService;
