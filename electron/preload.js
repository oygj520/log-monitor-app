const { contextBridge, ipcRenderer } = require('electron');

console.log('🔌 preload.js 开始执行');

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
  
  // 事件监听
  onLogUpdate: (callback) => {
    ipcRenderer.on('log-update', (event, data) => callback(data));
  },
  onAlert: (callback) => {
    ipcRenderer.on('alert', (event, data) => callback(data));
  },
  onMonitoringStatusChange: (callback) => {
    ipcRenderer.on('monitoring-status-change', (event, data) => callback(data));
  }
});

console.log('✅ electronAPI 暴露完成');
