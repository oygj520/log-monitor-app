const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const PathManager = require('./pathManager');
const LogMonitorService = require('./logMonitorService');
const DatabaseService = require('./databaseService');

let mainWindow;
let logMonitorService = null;
let databaseService = null;

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
    title: '日志监控系统'
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
  return logMonitorService.startMonitoring(config);
});

ipcMain.handle('stop-monitoring', async (event, id) => {
  return logMonitorService.stopMonitoring(id);
});

ipcMain.handle('get-monitoring-status', async () => {
  return logMonitorService.getStatus();
});

ipcMain.handle('get-logs', async (event, options) => {
  return databaseService.getLogs(options);
});

ipcMain.handle('get-log-statistics', async (event, options) => {
  return databaseService.getStatistics(options);
});

// 配置管理
ipcMain.handle('save-config', async (event, config) => {
  const configPath = PathManager.getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return { success: true };
});

ipcMain.handle('load-config', async () => {
  const configPath = PathManager.getConfigPath();
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
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
  mainWindow.flashFrame(true);
  return { success: true };
});
