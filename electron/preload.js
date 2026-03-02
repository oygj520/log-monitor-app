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
  },
  onArchiveComplete: (callback) => {
    ipcRenderer.on('archive-complete', (event, data) => callback(data));
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
  
  // 健康状态监听
  onHealthStatus: (callback) => {
    ipcRenderer.on('health-status', (event, data) => callback(data));
  }
});

console.log('✅ electronAPI 暴露完成');
