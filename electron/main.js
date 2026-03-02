const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const PathManager = require('./pathManager');
const LogMonitorService = require('./logMonitorService');
const DatabaseService = require('./databaseService');
const ApiService = require('./apiService');

let mainWindow;
let logMonitorService = null;
let databaseService = null;
let apiService = null;
let healthCheckInterval = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../build/icon.ico'),
    title: '日志监控系统',
    show: false // 先不显示，等加载完成再显示
  });
  
  // 页面加载完成后显示窗口
  mainWindow.once('ready-to-show', () => {
    console.log('✅ 窗口准备就绪，显示窗口');
    mainWindow.show();
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  // 添加调试日志
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✅ 页面加载完成');
  });
  
  mainWindow.webContents.on('did-fail-load', (event, code, desc) => {
    console.error('❌ 页面加载失败:', code, desc);
  });
  
  mainWindow.webContents.on('crashed', () => {
    console.error('❌ 渲染进程崩溃');
  });
  
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('❌ 渲染进程丢失:', details);
  });
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    const htmlPath = path.join(__dirname, '../build/index.html');
    console.log('📁 加载文件路径:', htmlPath);
    console.log('📁 __dirname:', __dirname);
    mainWindow.loadFile(htmlPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  console.log('🚀 app.whenReady 触发');
  
  try {
    // 初始化路径管理器
    PathManager.initialize();
    console.log('✅ 路径管理器初始化完成');
    
    // 初始化数据库服务
    databaseService = new DatabaseService();
    await databaseService.initialize();
    console.log('✅ 数据库服务初始化完成');
    
    // 初始化日志监控服务
    logMonitorService = new LogMonitorService(databaseService);
    console.log('✅ 日志监控服务初始化完成');
    
    // 初始化 API 服务
    const configPath = PathManager.getConfigPath();
    apiService = new ApiService(databaseService, configPath);
    await apiService.initialize();
    console.log('✅ API 服务初始化完成');
    
    // 启动健康状态监控
    startHealthMonitoring();
    console.log('✅ 健康监控已启动');
    
    // 配置备份
    setupConfigBackup();
    console.log('✅ 配置备份已设置');
    
    createWindow();
    console.log('✅ 窗口创建完成');
  } catch (error) {
    console.error('❌ 初始化失败:', error);
    dialog.showErrorBox('初始化错误', error.message);
  }
});

app.on('window-all-closed', () => {
  if (logMonitorService) {
    logMonitorService.stopAll();
  }
  if (databaseService) {
    databaseService.close();
  }
  if (apiService) {
    apiService.stopServer();
  }
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC 通信处理
ipcMain.handle('get-app-path', () => {
  return PathManager.getAppPath();
});

ipcMain.handle('get-data-path', () => {
  return PathManager.getDataPath();
});

ipcMain.handle('get-config-path', () => {
  return PathManager.getConfigPath();
});

// 日志监控相关
ipcMain.handle('start-monitoring', async (event, config) => {
  console.log('[IPC] 启动监控:', config);
  const result = await logMonitorService.startMonitoring(config);
  console.log('[IPC] 监控启动结果:', result);
  return result;
});

ipcMain.handle('stop-monitoring', async (event, id) => {
  console.log('[IPC] 停止监控:', id);
  return logMonitorService.stopMonitoring(id);
});

ipcMain.handle('get-monitoring-status', async () => {
  const status = logMonitorService.getStatus();
  console.log('[IPC] 获取监控状态:', status);
  return status;
});

// 3. 后端过滤：支持过滤条件查询
ipcMain.handle('get-logs', async (event, options) => {
  console.log('[IPC] 获取日志，过滤条件:', options);
  const result = databaseService.getLogs(options);
  console.log('[IPC] 返回日志数量:', result.logs?.length || 0, '总数:', result.total || 0);
  return result;
});

ipcMain.handle('get-log-statistics', async (event, options) => {
  return databaseService.getStatistics(options);
});

// 配置管理
ipcMain.handle('save-config', async (event, config) => {
  const configPath = PathManager.getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log('[IPC] 配置已保存:', configPath);
  return { success: true };
});

ipcMain.handle('load-config', async () => {
  const configPath = PathManager.getConfigPath();
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    console.log('[IPC] 配置已加载:', configPath);
    return config;
  }
  console.log('[IPC] 配置文件不存在');
  return null;
});

// 文件选择
ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['multiSelections', 'openFile'],
    filters: [
      { name: '日志文件', extensions: ['log', 'txt', 'json'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  });
  return result.filePaths;
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.filePaths;
});

// 告警通知
ipcMain.handle('show-notification', async (event, title, message) => {
  if (mainWindow) {
    mainWindow.flashFrame(true);
  }
  return { success: true };
});

// API 服务相关
ipcMain.handle('get-api-status', async () => {
  return apiService ? apiService.getStatus() : { enabled: false };
});

ipcMain.handle('update-api-config', async (event, config) => {
  if (!apiService) {
    return { success: false, error: 'API service not initialized' };
  }
  try {
    const result = await apiService.updateConfig(config);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('trigger-webhook', async (event, eventData) => {
  if (!apiService) {
    return { success: false, error: 'API service not initialized' };
  }
  try {
    await apiService.triggerWebhook(eventData.event, eventData.data);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 高可用相关
ipcMain.handle('get-health-status', async () => {
  return {
    database: databaseService ? 'connected' : 'disconnected',
    monitor: logMonitorService ? 'running' : 'stopped',
    api: apiService ? apiService.getStatus() : { enabled: false },
    uptime: process.uptime(),
    memory: process.getProcessMemoryInfo(),
    timestamp: new Date().toISOString()
  };
});

ipcMain.handle('backup-config', async () => {
  try {
    const configPath = PathManager.getConfigPath();
    const backupPath = configPath + '.backup.' + Date.now();
    if (fs.existsSync(configPath)) {
      fs.copyFileSync(configPath, backupPath);
      console.log('[IPC] 配置已备份:', backupPath);
      return { success: true, backupPath };
    }
    return { success: false, error: 'Config file not found' };
  } catch (error) {
    console.error('[IPC] 配置备份失败:', error);
    return { success: false, error: error.message };
  }
});

// 渲染进程崩溃恢复
mainWindow?.webContents.on('render-process-gone', (event, details) => {
  console.error('❌ 渲染进程丢失:', details);
  // 自动重启渲染进程
  if (mainWindow) {
    console.log('🔄 尝试恢复渲染进程...');
    mainWindow.reload();
  }
});

// 健康状态监控
function startHealthMonitoring() {
  healthCheckInterval = setInterval(() => {
    const health = {
      database: databaseService ? 'connected' : 'disconnected',
      monitor: logMonitorService ? 'running' : 'stopped',
      api: apiService ? apiService.getStatus() : { enabled: false },
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
    
    // 如果数据库断开，尝试重连
    if (health.database === 'disconnected' && databaseService) {
      console.warn('⚠️ 数据库连接丢失，尝试重连...');
      databaseService.initialize().catch(err => {
        console.error('❌ 数据库重连失败:', err);
      });
    }
    
    // 通知渲染进程健康状态
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('health-status', health);
    }
  }, 30000); // 每 30 秒检查一次
}

// 配置自动备份
function setupConfigBackup() {
  // 每小时备份一次配置
  setInterval(async () => {
    try {
      const configPath = PathManager.getConfigPath();
      const backupPath = PathManager.getDataPath() + '/backups';
      
      // 创建备份目录
      if (!fs.existsSync(backupPath)) {
        fs.mkdirSync(backupPath, { recursive: true });
      }
      
      if (fs.existsSync(configPath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(backupPath, `config.${timestamp}.json`);
        fs.copyFileSync(configPath, backupFile);
        console.log('[Backup] 配置已自动备份:', backupFile);
        
        // 清理 7 天前的备份
        const files = fs.readdirSync(backupPath);
        const now = Date.now();
        files.forEach(file => {
          const filePath = path.join(backupPath, file);
          const stats = fs.statSync(filePath);
          if (now - stats.mtimeMs > 7 * 24 * 60 * 60 * 1000) {
            fs.unlinkSync(filePath);
            console.log('[Backup] 清理旧备份:', file);
          }
        });
      }
    } catch (error) {
      console.error('[Backup] 自动备份失败:', error);
    }
  }, 60 * 60 * 1000); // 每小时
}

// 告警管理
ipcMain.handle('get-alert-history', async (event, options) => {
  return logMonitorService.getAlertHistory(options);
});

ipcMain.handle('get-alert-statistics', async (event, startDate, endDate) => {
  return logMonitorService.getAlertStatistics(startDate, endDate);
});

ipcMain.handle('acknowledge-alert', async (event, alertId) => {
  return logMonitorService.acknowledgeAlert(alertId);
});

ipcMain.handle('export-alert-rules', async () => {
  return logMonitorService.exportAlertRules();
});

ipcMain.handle('import-alert-rules', async (event, jsonString) => {
  return logMonitorService.importAlertRules(jsonString);
});

// 归档管理
ipcMain.handle('get-archive-list', async () => {
  return logMonitorService.getArchiveList();
});

ipcMain.handle('query-archive-logs', async (event, archiveId, options) => {
  return logMonitorService.queryArchiveLogs(archiveId, options);
});

ipcMain.handle('get-archive-statistics', async () => {
  return logMonitorService.getArchiveStatistics();
});

ipcMain.handle('trigger-archive', async (event, daysToKeep) => {
  return await logMonitorService.triggerArchive(daysToKeep || 7);
});

ipcMain.handle('delete-archive', async (event, archiveId) => {
  return logMonitorService.databaseService.deleteArchive(archiveId);
});

// 增量查询
ipcMain.handle('get-incremental-logs', async (event, options) => {
  return databaseService.getIncrementalLogs(options);
});

// 系统事件
ipcMain.handle('cleanup', async () => {
  console.log('[IPC] 清理资源');
  if (logMonitorService) {
    logMonitorService.stopAll();
  }
  if (databaseService) {
    databaseService.close();
  }
  return { success: true };
});
