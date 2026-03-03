const { contextBridge, ipcRenderer } = require('electron');

// ============================================
// 第 9 轮修复：移除沙箱环境不兼容的 API
// 说明：Electron 沙箱环境中不可使用 __dirname 和 process
// ============================================
console.log('============================================');
console.log('🔌 preload.js 开始执行 (沙箱兼容模式)');
console.log('📦 Electron 版本:', require('electron').ipcRenderer ? 'IPC 可用' : 'IPC 不可用');
console.log('============================================');

// 全局错误捕获
window.addEventListener('error', (event) => {
  console.error('❌ [Preload] 全局错误:', event.message);
  console.error('❌ [Preload] 错误堆栈:', event.error?.stack);
  ipcRenderer.send('preload-error', {
    message: event.message,
    stack: event.error?.stack,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ [Preload] 未处理的 Promise 拒绝:', event.reason);
  ipcRenderer.send('preload-error', {
    type: 'unhandledrejection',
    reason: event.reason?.toString()
  });
});

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 路径相关
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  getDataPath: () => ipcRenderer.invoke('get-data-path'),
  getConfigPath: () => ipcRenderer.invoke('get-config-path'),
  
  // 日志监控
  startMonitoring: (config) => ipcRenderer.invoke('start-monitoring', config),
  stopMonitoring: (id) => ipcRenderer.invoke('stop-monitoring', id),
  getMonitoringStatus: () => ipcRenderer.invoke('get-monitoring-status'),
  
  // 日志数据
  getLogs: (options) => ipcRenderer.invoke('get-logs', options),
  getLogStatistics: (options) => ipcRenderer.invoke('get-log-statistics', options),
  
  // 配置管理
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  loadConfig: () => ipcRenderer.invoke('load-config'),
  
  // 文件选择
  selectFiles: () => ipcRenderer.invoke('select-files'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  
  // 通知
  showNotification: (title, message) => ipcRenderer.invoke('show-notification', title, message),
  
  // 事件监听 - 修复 callback 错误：检查 callback 是否为函数
  onLogUpdate: (callback) => {
    if (typeof callback !== 'function') {
      console.warn('[preload] onLogUpdate: callback 不是函数，忽略注册');
      return () => {}; // 返回空函数
    }
    const listener = (event, data) => callback(data);
    ipcRenderer.on('log-update', listener);
    return () => ipcRenderer.removeListener('log-update', listener);
  },
  onAlert: (callback) => {
    if (typeof callback !== 'function') {
      console.warn('[preload] onAlert: callback 不是函数，忽略注册');
      return () => {};
    }
    const listener = (event, data) => callback(data);
    ipcRenderer.on('alert', listener);
    return () => ipcRenderer.removeListener('alert', listener);
  },
  onMonitoringStatusChange: (callback) => {
    if (typeof callback !== 'function') {
      console.warn('[preload] onMonitoringStatusChange: callback 不是函数，忽略注册');
      return () => {};
    }
    const listener = (event, data) => callback(data);
    ipcRenderer.on('monitoring-status-change', listener);
    return () => ipcRenderer.removeListener('monitoring-status-change', listener);
  },
  onArchiveComplete: (callback) => {
    if (typeof callback !== 'function') {
      console.warn('[preload] onArchiveComplete: callback 不是函数，忽略注册');
      return () => {};
    }
    const listener = (event, data) => callback(data);
    ipcRenderer.on('archive-complete', listener);
    return () => ipcRenderer.removeListener('archive-complete', listener);
  },
  
  // 告警管理
  getAlertHistory: (options) => ipcRenderer.invoke('get-alert-history', options),
  getAlertStatistics: (startDate, endDate) => ipcRenderer.invoke('get-alert-statistics', startDate, endDate),
  acknowledgeAlert: (alertId) => ipcRenderer.invoke('acknowledge-alert', alertId),
  exportAlertRules: () => ipcRenderer.invoke('export-alert-rules'),
  importAlertRules: (jsonString) => ipcRenderer.invoke('import-alert-rules', jsonString),
  
  // 归档管理
  getArchiveList: () => ipcRenderer.invoke('get-archive-list'),
  queryArchiveLogs: (archiveId, options) => ipcRenderer.invoke('query-archive-logs', archiveId, options),
  getArchiveStatistics: () => ipcRenderer.invoke('get-archive-statistics'),
  triggerArchive: (daysToKeep) => ipcRenderer.invoke('trigger-archive', daysToKeep),
  deleteArchive: (archiveId) => ipcRenderer.invoke('delete-archive', archiveId),
  
  // 增量查询
  getIncrementalLogs: (options) => ipcRenderer.invoke('get-incremental-logs', options),
  
  // 系统
  cleanup: () => ipcRenderer.invoke('cleanup'),
  
  // API 服务
  getApiStatus: () => ipcRenderer.invoke('get-api-status'),
  updateApiConfig: (config) => ipcRenderer.invoke('update-api-config', config),
  triggerWebhook: (eventData) => ipcRenderer.invoke('trigger-webhook', eventData),
  
  // 高可用
  getHealthStatus: () => ipcRenderer.invoke('get-health-status'),
  backupConfig: () => ipcRenderer.invoke('backup-config'),
  
  // 系统信息
  getUptime: () => ipcRenderer.invoke('get-uptime'),
  
  // 健康状态监听 - 修复 callback 错误：检查 callback 是否为函数
  onHealthStatus: (callback) => {
    if (typeof callback !== 'function') {
      console.warn('[preload] onHealthStatus: callback 不是函数，忽略注册');
      return () => {};
    }
    const listener = (event, data) => callback(data);
    ipcRenderer.on('health-status', listener);
    return () => ipcRenderer.removeListener('health-status', listener);
  }
});

console.log('✅ electronAPI 暴露完成');
console.log('============================================');
console.log('✅ preload.js 执行完成');
console.log('============================================');

// 通知主进程 preload 已加载
ipcRenderer.send('preload-loaded');
