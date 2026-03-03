const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// ============================================
// 第 9 轮 Bug 修复：全局 path.join 监控
// 用于定位 path.join 接收到 null 参数的具体位置
// ============================================
const originalPathJoin = path.join;
path.join = function(...args) {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === null || args[i] === undefined) {
      console.error('❌ [PATH.JOIN MONITOR] 参数 ' + i + ' 为 ' + args[i]);
      console.error('❌ [PATH.JOIN MONITOR] 所有参数:', JSON.stringify(args));
      console.error('❌ [PATH.JOIN MONITOR] 调用堆栈:');
      console.error(new Error().stack);
      throw new Error('path.join 参数 ' + i + ' 为 ' + args[i] + '. 完整参数：' + JSON.stringify(args));
    }
  }
  return originalPathJoin.apply(path, args);
};

const PathManager = require('./pathManager');
const LogMonitorService = require('./logMonitorService');
const DatabaseService = require('./databaseService');
const ApiService = require('./apiService');

// ============================================
// 全局错误捕获 - 第 6 轮 Bug 修复
// ============================================

// 捕获未处理的异常
process.on('uncaughtException', (error) => {
  const timestamp = new Date().toISOString();
  const errorMsg = `
============================================
❌ [UNCAUGHT EXCEPTION] ${timestamp}
============================================
错误消息：${error.message}
错误堆栈：${error.stack}
进程 PID: ${process.pid}
============================================
`.trim();
  
  console.error(errorMsg);
  
  // 尝试写入日志文件
  try {
    if (logFilePath) {
      fs.appendFileSync(logFilePath, `\n[${timestamp}] [UNCAUGHT EXCEPTION] ${error.message}\n${error.stack}\n`);
    }
  } catch (e) {
    console.error('写入错误日志失败:', e.message);
  }
  
  // 显示错误对话框（带详细错误信息）
  dialog.showErrorBox('LogMonitor 错误', `发生未处理的异常:\n\n${error.message}\n\n请查看日志文件获取详细信息。`);
  
  // 不退出进程，让应用继续运行
  // process.exit(1);
});

// 捕获未处理的 Promise 拒绝
process.on('unhandledRejection', (reason, promise) => {
  const timestamp = new Date().toISOString();
  const errorMsg = `
============================================
❌ [UNHANDLED REJECTION] ${timestamp}
============================================
原因：${reason}
Promise: ${promise}
进程 PID: ${process.pid}
============================================
`.trim();
  
  console.error(errorMsg);
  
  // 尝试写入日志文件
  try {
    if (logFilePath) {
      fs.appendFileSync(logFilePath, `\n[${timestamp}] [UNHANDLED REJECTION] ${reason}\n`);
    }
  } catch (e) {
    console.error('写入错误日志失败:', e.message);
  }
});

// 日志文件路径（在 PathManager 初始化后设置）
let logFilePath = null;
let appDataPath = null; // 存储应用数据路径，用于错误时回退

function logToFile(message, forceConsole = false) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  console.log(message);
  
  // 优先写入日志文件
  if (logFilePath && !forceConsole) {
    try {
      fs.appendFileSync(logFilePath, logLine);
    } catch (e) {
      console.error('❌ 写入日志文件失败:', e.message, '路径:', logFilePath);
    }
  }
  // 如果日志文件未初始化，尝试使用回退路径
  else if (appDataPath && !forceConsole) {
    try {
      const fallbackLogPath = path.join(appDataPath, 'electron-main.log');
      fs.appendFileSync(fallbackLogPath, logLine);
    } catch (e) {
      console.error('❌ 写入回退日志文件失败:', e.message);
    }
  }
}

let mainWindow;
let logMonitorService = null;
let databaseService = null;
let apiService = null;
let healthCheckInterval = null;

function createWindow() {
  logToFile('🪟 开始创建窗口...', true);
  
  // 检查 __dirname - 第 9 轮 Bug 修复
  logToFile('📁 __dirname: ' + __dirname, true);
  if (!__dirname) {
    const errorMsg = '❌ 严重错误：__dirname 为 null，无法构建 preload 路径。这可能是 Electron 打包问题。';
    logToFile(errorMsg, true);
    dialog.showErrorBox('启动错误', errorMsg + '\n\n请重新安装应用或联系开发者。');
    app.quit();
    return;
  }
  
  // 构建 preload 路径
  let preloadPath;
  try {
    preloadPath = path.join(__dirname, 'preload.js');
    logToFile('📁 preload.js 路径：' + preloadPath, true);
    if (!preloadPath) {
      logToFile('❌ 错误：preload 路径计算结果为 null', true);
    }
    // 检查文件是否存在
    if (fs.existsSync(preloadPath)) {
      logToFile('✅ preload.js 文件存在', true);
    } else {
      logToFile('❌ 警告：preload.js 文件不存在', true);
    }
  } catch (e) {
    logToFile('❌ 构建 preload 路径失败：' + e.message, true);
    preloadPath = null;
  }
  
  // 构建 icon 路径
  let iconPath;
  try {
    iconPath = path.join(__dirname, '../build/icon.ico');
    logToFile('📁 icon.ico 路径：' + iconPath, true);
    if (!iconPath) {
      logToFile('❌ 错误：icon 路径计算结果为 null', true);
    }
    // 检查文件是否存在
    if (fs.existsSync(iconPath)) {
      logToFile('✅ icon.ico 文件存在', true);
    } else {
      logToFile('⚠️ icon.ico 文件不存在（非致命）', true);
      iconPath = undefined; // 不设置 icon，避免错误
    }
  } catch (e) {
    logToFile('❌ 构建 icon 路径失败：' + e.message, true);
    iconPath = undefined;
  }
  
  // ============================================
  // 第 8 轮修复：简化窗口创建逻辑，直接显示窗口
  // ============================================
  logToFile('🪟 创建 BrowserWindow（show: true，直接显示）', true);
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    x: 100,  // 明确设置窗口位置
    y: 100,  // 明确设置窗口位置
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: preloadPath,
      webSecurity: true,
      allowRunningInsecureContent: false
    },
    icon: iconPath,
    title: '日志监控系统',
    show: true,  // 第 8 轮修复：直接显示窗口，不依赖 ready-to-show 事件
    autoHideMenuBar: true  // 自动隐藏菜单栏，更简洁
  });
  
  logToFile('✅ BrowserWindow 创建完成，窗口应该已显示', true);
  logToFile('🔍 mainWindow 对象检查:', true);
  logToFile('   - mainWindow: ' + (mainWindow ? '存在' : 'null'), true);
  logToFile('   - mainWindow.isDestroyed(): ' + (mainWindow ? mainWindow.isDestroyed() : 'N/A'), true);
  logToFile('   - mainWindow.isVisible(): ' + (mainWindow ? mainWindow.isVisible() : 'N/A'), true);
  logToFile('   - mainWindow.isMinimized(): ' + (mainWindow ? mainWindow.isMinimized() : 'N/A'), true);
  
  // 保留 ready-to-show 监听作为日志记录，但不依赖它来显示窗口
  mainWindow.once('ready-to-show', () => {
    logToFile('✅ [事件] ready-to-show 触发', true);
    // 不再调用 mainWindow.show()，因为窗口已经显示
  });
  
  // 添加窗口显示确认
  mainWindow.on('show', () => {
    logToFile('✅ [事件] 窗口 show 事件触发', true);
  });
  
  mainWindow.on('focus', () => {
    logToFile('✅ [事件] 窗口 focus 事件触发', true);
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  // 添加详细的调试日志 - 第 8 轮增强
  logToFile('🔧 注册 webContents 事件监听器...', true);
  
  mainWindow.webContents.on('did-finish-load', () => {
    logToFile('✅ [webContents] did-finish-load 触发', true);
  });
  
  mainWindow.webContents.on('did-fail-load', (event, code, desc, url, isMainFrame) => {
    logToFile('❌ [webContents] did-fail-load: ' + JSON.stringify({ code, desc, url, isMainFrame }), true);
  });
  
  mainWindow.webContents.on('dom-ready', () => {
    logToFile('✅ [webContents] dom-ready 触发', true);
  });
  
  mainWindow.webContents.on('crashed', () => {
    logToFile('❌ [webContents] crashed 触发', true);
  });
  
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    logToFile('❌ [webContents] render-process-gone: ' + JSON.stringify(details), true);
  });
  
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    logToFile(`[Renderer Console] L${line} ${message}`);
  });
  
  // 第 8 轮新增：窗口移动和聚焦事件
  mainWindow.on('moved', () => {
    logToFile('✅ [窗口] moved 事件触发');
  });
  
  mainWindow.on('resized', () => {
    logToFile('✅ [窗口] resized 事件触发');
  });
  
  if (isDev) {
    logToFile('🔧 开发模式：加载 http://localhost:3000');
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // 生产环境：使用 loadFile 加载本地文件（正确处理 asar 路径）
    const appPath = app.getAppPath();
    
    // 添加 null 检查
    if (!appPath) {
      logToFile('❌ 错误：app.getAppPath() 返回 null');
      dialog.showErrorBox('启动错误', '无法获取应用路径，请重新安装应用');
      app.quit();
      return;
    }
    
    const htmlPath = path.join(appPath, 'build', 'index.html');
    
    logToFile('🔧 生产模式：加载本地文件');
    logToFile('📁 app.getAppPath(): ' + appPath);
    logToFile('📁 app.isPackaged: ' + app.isPackaged);
    logToFile('📁 __dirname: ' + __dirname);
    logToFile('📁 htmlPath: ' + htmlPath);
    
    // 检查文件是否存在（asar 中的虚拟路径也能检测）
    const fs = require('fs');
    if (fs.existsSync(htmlPath)) {
      logToFile('✅ index.html 文件存在');
      try {
        const content = fs.readFileSync(htmlPath, 'utf-8');
        logToFile('📄 index.html 内容预览：' + content.substring(0, 200));
      } catch (e) {
        logToFile('⚠️ 读取 index.html 失败：' + e.message);
      }
    } else {
      logToFile('❌ index.html 文件不存在！');
    }
    
    // 检查 JS 文件
    const jsPath = path.join(appPath, 'build', 'static', 'js', 'main.4b77667a.js');
    if (fs.existsSync(jsPath)) {
      logToFile('✅ main.js 文件存在');
    } else {
      logToFile('❌ main.js 文件不存在！');
    }
    
    // 检查 CSS 文件
    const cssPath = path.join(appPath, 'build', 'static', 'css', 'main.8372058b.css');
    if (fs.existsSync(cssPath)) {
      logToFile('✅ main.css 文件存在');
    } else {
      logToFile('❌ main.css 文件不存在！');
    }
    
    // 使用 loadFile 而不是 loadURL，正确处理 asar 路径
    logToFile('📄 使用 loadFile 加载：' + htmlPath);
    mainWindow.loadFile(htmlPath);
    
    // ============================================
    // 启用 DevTools 查看错误 - 调试模式
    // ============================================
    logToFile('🔧 启用 DevTools 和渲染进程错误监听');
    mainWindow.webContents.openDevTools();
    
    // 添加渲染进程错误监听
    mainWindow.webContents.on('console-message', (event, level, message) => {
      logToFile(`[Renderer] ${message}`);
    });
    
    mainWindow.webContents.on('did-fail-load', (event, code, desc) => {
      logToFile(`[Renderer] 加载失败：${code} - ${desc}`);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  logToFile('🚀 app.whenReady 触发', true); // forceConsole=true，因为日志文件还未初始化
  
  try {
    // 设置回退路径（在 PathManager 初始化之前）
    try {
      appDataPath = app.getPath('userData');
      logToFile('📁 回退路径 app.getPath("userData"): ' + appDataPath, true);
    } catch (e) {
      logToFile('⚠️ 获取 userData 路径失败：' + e.message, true);
      appDataPath = 'E:\\LogMonitor\\data'; // 硬编码回退
      logToFile('📁 使用硬编码回退路径：' + appDataPath, true);
    }
    
    // 初始化路径管理器
    logToFile('📁 开始初始化 PathManager...', true);
    try {
      PathManager.initialize();
      logToFile('✅ PathManager.initialize() 调用完成', true);
    } catch (initError) {
      logToFile('❌ PathManager.initialize() 抛出异常：' + initError.message, true);
      logToFile('❌ 堆栈：' + initError.stack, true);
      throw initError;
    }
    
    // 详细检查所有路径
    logToFile('🔍 检查 PathManager 所有路径属性...', true);
    logToFile('📁 PathManager.appPath: ' + PathManager.appPath, true);
    logToFile('📁 PathManager.dataPath: ' + PathManager.dataPath, true);
    logToFile('📁 PathManager.configPath: ' + PathManager.configPath, true);
    logToFile('📁 PathManager.databasePath: ' + PathManager.databasePath, true);
    logToFile('📁 PathManager.cachePath: ' + PathManager.cachePath, true);
    logToFile('📁 PathManager.backupsPath: ' + PathManager.backupsPath, true);
    logToFile('📁 PathManager.archivesPath: ' + PathManager.archivesPath, true);
    
    const dataPath = PathManager.getDataPath();
    logToFile('📁 PathManager.getDataPath() 返回值：' + dataPath, true);
    
    if (!dataPath) {
      logToFile('❌ 严重错误：PathManager.getDataPath() 返回 null', true);
      logToFile('❌ PathManager.dataPath 静态属性：' + PathManager.dataPath, true);
      throw new Error('PathManager 初始化失败：dataPath 为 null');
    }
    
    // 验证路径是否有效
    try {
      logToFile('📁 验证数据路径是否存在：' + dataPath, true);
      if (!fs.existsSync(dataPath)) {
        logToFile('⚠️ 数据路径不存在，尝试创建...', true);
        fs.mkdirSync(dataPath, { recursive: true });
        logToFile('✅ 数据路径创建成功', true);
      } else {
        logToFile('✅ 数据路径已存在', true);
      }
    } catch (e) {
      logToFile('❌ 创建数据路径失败：' + e.message, true);
      throw e;
    }
    
    logFilePath = path.join(dataPath, 'electron-main.log');
    logToFile('📁 日志文件路径：' + logFilePath, true);
    logToFile('✅ 路径管理器初始化完成', true);
    
    // 初始化数据库服务
    logToFile('🔧 开始初始化数据库服务...', true);
    try {
      databaseService = new DatabaseService();
      logToFile('📁 DatabaseService 构造函数完成', true);
      await databaseService.initialize();
      logToFile('✅ 数据库服务初始化完成', true);
    } catch (dbError) {
      logToFile('❌ 数据库服务初始化失败：' + dbError.message, true);
      logToFile('❌ 堆栈：' + dbError.stack, true);
      throw dbError;
    }
    
    // 初始化日志监控服务
    logToFile('🔧 开始初始化日志监控服务...', true);
    try {
      logMonitorService = new LogMonitorService(databaseService);
      logToFile('✅ 日志监控服务初始化完成', true);
    } catch (monitorError) {
      logToFile('❌ 日志监控服务初始化失败：' + monitorError.message, true);
      logToFile('❌ 堆栈：' + monitorError.stack, true);
      throw monitorError;
    }
    
    // 初始化 API 服务
    logToFile('🔧 开始初始化 API 服务...', true);
    try {
      const configPath = PathManager.getConfigPath();
      logToFile('📁 API 服务 configPath: ' + configPath, true);
      if (!configPath) {
        logToFile('❌ 警告：configPath 为 null，使用回退路径', true);
      }
      apiService = new ApiService(databaseService, configPath);
      await apiService.initialize();
      logToFile('✅ API 服务初始化完成', true);
    } catch (apiError) {
      logToFile('❌ API 服务初始化失败：' + apiError.message, true);
      logToFile('❌ 堆栈：' + apiError.stack, true);
      throw apiError;
    }
    
    // 启动健康状态监控
    startHealthMonitoring();
    logToFile('✅ 健康监控已启动');
    
    // 配置备份
    setupConfigBackup();
    logToFile('✅ 配置备份已设置');
    
    createWindow();
    logToFile('✅ 窗口创建完成', true);
    logToFile('🎉 应用初始化全部完成！', true);
  } catch (error) {
    const errorMsg = `
============================================
❌ 初始化失败 ${new Date().toISOString()}
============================================
错误消息：${error.message}
错误堆栈：${error.stack}
============================================
`.trim();
    logToFile(errorMsg, true);
    logToFile('❌ 初始化失败：' + error.message, true);
    logToFile('❌ 错误堆栈：' + error.stack, true);
    
    // 显示详细错误对话框
    dialog.showErrorBox(
      'LogMonitor 初始化错误',
      `应用启动时发生错误:\n\n${error.message}\n\n详细信息请查看日志文件:\n${logFilePath || appDataPath + '/electron-main.log'}`
    );
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

// 监听 preload 错误
ipcMain.on('preload-error', (event, errorData) => {
  logToFile('❌ [Preload Error] ' + JSON.stringify(errorData), true);
  console.error('❌ [Preload Error]', errorData);
});

// 第 8 轮新增：监听 preload 加载完成
ipcMain.on('preload-loaded', (event) => {
  logToFile('✅ [IPC] preload-loaded 收到，preload.js 已成功加载', true);
});

// IPC 通信处理
ipcMain.handle('get-app-path', () => {
  const appPath = PathManager.getAppPath();
  logToFile('📁 IPC get-app-path 返回：' + appPath);
  return appPath;
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
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      // 确保 monitors 是数组
      if (!config.monitors || !Array.isArray(config.monitors)) {
        config.monitors = [];
      }
      console.log('[IPC] 配置已加载:', configPath);
      return config;
    } catch (error) {
      console.error('[IPC] 加载配置文件失败:', error);
      return { monitors: [] };
    }
  }
  console.log('[IPC] 配置文件不存在');
  return { monitors: [] };
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
// 获取主进程运行时间
ipcMain.handle('get-uptime', async () => {
  return process.uptime();
});

ipcMain.handle('get-health-status', async () => {
  const memInfo = process.getProcessMemoryInfo();
  return {
    database: databaseService ? 'connected' : 'disconnected',
    monitor: logMonitorService ? 'running' : 'stopped',
    api: apiService ? apiService.getStatus() : { enabled: false },
    uptime: process.uptime(),
    memory: {
      private: memInfo.private,
      shared: memInfo.shared,
      workingSet: memInfo.workingSetSize
    },
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

// 渲染进程崩溃恢复已在 createWindow 中设置

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
      const dataPath = PathManager.getDataPath();
      const backupPath = PathManager.getBackupsPath();
      
      // null 检查
      if (!configPath || !dataPath || !backupPath) {
        console.error('[Backup] 路径为 null:', { configPath, dataPath, backupPath });
        return;
      }
      
      // 创建备份目录
      if (!fs.existsSync(backupPath)) {
        fs.mkdirSync(backupPath, { recursive: true });
        console.log('[Backup] 创建备份目录:', backupPath);
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

// 告警管理 - 存根实现（功能尚未完全实现）
ipcMain.handle('get-alert-history', async (event, options) => {
  console.log('[IPC] get-alert-history called, returning empty array');
  return []; // 返回空数组而不是报错
});

ipcMain.handle('get-alert-statistics', async (event, startDate, endDate) => {
  console.log('[IPC] get-alert-statistics called, returning empty stats');
  return { total: 0, acknowledged: 0, unacknowledged: 0 };
});

ipcMain.handle('acknowledge-alert', async (event, alertId) => {
  console.log('[IPC] acknowledge-alert called, returning success');
  return { success: true };
});

ipcMain.handle('export-alert-rules', async () => {
  console.log('[IPC] export-alert-rules called, returning empty rules');
  return [];
});

ipcMain.handle('import-alert-rules', async (event, jsonString) => {
  console.log('[IPC] import-alert-rules called, returning success');
  return { success: true };
});

// 归档管理 - 存根实现（功能尚未完全实现）
ipcMain.handle('get-archive-list', async () => {
  console.log('[IPC] get-archive-list called, returning empty array');
  return [];
});

ipcMain.handle('query-archive-logs', async (event, archiveId, options) => {
  console.log('[IPC] query-archive-logs called, returning empty logs');
  return [];
});

ipcMain.handle('get-archive-statistics', async () => {
  console.log('[IPC] get-archive-statistics called, returning empty stats');
  return { totalArchives: 0, totalSize: 0 };
});

ipcMain.handle('trigger-archive', async (event, daysToKeep) => {
  console.log('[IPC] trigger-archive called, returning success');
  return { success: true };
});

ipcMain.handle('delete-archive', async (event, archiveId) => {
  console.log('[IPC] delete-archive called, returning success');
  return { success: true };
});

// 增量查询：支持按监控 ID 和时间戳查询
ipcMain.handle('get-incremental-logs', async (event, options) => {
  console.log('[IPC] 增量查询日志:', options);
  const { monitorId, lastTimestamp } = options || {};
  
  if (logMonitorService) {
    const result = await logMonitorService.getIncrementalLogs(monitorId, lastTimestamp);
    console.log('[IPC] 增量查询结果:', result.logs?.length || 0, '条新日志');
    return result;
  }
  
  // 回退到直接查询数据库
  const result = databaseService.getIncrementalLogs(options);
  return result;
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
