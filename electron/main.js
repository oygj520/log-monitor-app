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
