/**
 * 配置管理服务
 * 处理配置的加载、保存和验证
 */

// 默认配置
const DEFAULT_CONFIG = {
  version: '1.0.0',
  settings: {
    dataPath: 'E:\\LogMonitor\\data',
    autoStart: false,
    minimizeToTray: true,
    notificationEnabled: true,
    logRetentionDays: 30,
    refreshInterval: 5,
    theme: 'light',
    language: 'zh-CN'
  },
  monitors: [],
  alerts: {
    email: {
      enabled: false,
      recipients: [],
      smtpServer: '',
      smtpPort: 587,
      username: '',
      password: ''
    },
    webhook: {
      enabled: false,
      url: '',
      method: 'POST',
      headers: {}
    },
    sound: {
      enabled: true,
      file: ''
    }
  }
};

/**
 * 加载配置
 */
export async function loadConfig() {
  try {
    if (window.electronAPI) {
      const config = await window.electronAPI.loadConfig();
      return mergeWithDefaults(config);
    }
  } catch (error) {
    console.error('加载配置失败:', error);
  }
  
  return { ...DEFAULT_CONFIG };
}

/**
 * 保存配置
 */
export async function saveConfig(config) {
  try {
    if (window.electronAPI) {
      const validatedConfig = validateConfig(config);
      await window.electronAPI.saveConfig(validatedConfig);
      return { success: true };
    }
  } catch (error) {
    console.error('保存配置失败:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 获取设置
 */
export async function getSettings() {
  const config = await loadConfig();
  return config.settings || DEFAULT_CONFIG.settings;
}

/**
 * 更新设置
 */
export async function updateSettings(newSettings) {
  const config = await loadConfig();
  config.settings = { ...config.settings, ...newSettings };
  return saveConfig(config);
}

/**
 * 获取所有监控配置
 */
export async function getMonitors() {
  const config = await loadConfig();
  return config.monitors || [];
}

/**
 * 添加监控配置
 */
export async function addMonitor(monitor) {
  const config = await loadConfig();
  
  const newMonitor = {
    id: Date.now().toString(),
    ...monitor,
    status: 'stopped',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  config.monitors = [...(config.monitors || []), newMonitor];
  return saveConfig(config);
}

/**
 * 更新监控配置
 */
export async function updateMonitor(id, updates) {
  const config = await loadConfig();
  
  config.monitors = (config.monitors || []).map(monitor => {
    if (monitor.id === id) {
      return {
        ...monitor,
        ...updates,
        updatedAt: new Date().toISOString()
      };
    }
    return monitor;
  });
  
  return saveConfig(config);
}

/**
 * 删除监控配置
 */
export async function deleteMonitor(id) {
  const config = await loadConfig();
  config.monitors = (config.monitors || []).filter(m => m.id !== id);
  return saveConfig(config);
}

/**
 * 获取监控配置 by ID
 */
export async function getMonitor(id) {
  const monitors = await getMonitors();
  return monitors.find(m => m.id === id);
}

/**
 * 验证配置
 */
function validateConfig(config) {
  const validated = { ...DEFAULT_CONFIG };
  
  if (config) {
    // 合并设置
    if (config.settings) {
      validated.settings = { ...validated.settings, ...config.settings };
    }
    
    // 合并监控配置
    if (config.monitors) {
      validated.monitors = config.monitors.map(monitor => ({
        id: monitor.id || Date.now().toString(),
        name: monitor.name || '未命名监控',
        paths: monitor.paths || [],
        alertKeywords: monitor.alertKeywords || ['ERROR', 'FATAL', 'CRITICAL'],
        customKeywords: monitor.customKeywords || [],
        status: monitor.status || 'stopped',
        createdAt: monitor.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
    }
    
    // 合并告警配置
    if (config.alerts) {
      validated.alerts = { ...validated.alerts, ...config.alerts };
    }
  }
  
  validated.version = DEFAULT_CONFIG.version;
  validated.updatedAt = new Date().toISOString();
  
  return validated;
}

/**
 * 合并配置与默认值
 */
function mergeWithDefaults(config) {
  if (!config) {
    return { ...DEFAULT_CONFIG };
  }
  
  return {
    ...DEFAULT_CONFIG,
    ...config,
    settings: { ...DEFAULT_CONFIG.settings, ...(config.settings || {}) },
    alerts: {
      ...DEFAULT_CONFIG.alerts,
      ...config.alerts,
      email: { ...DEFAULT_CONFIG.alerts.email, ...(config.alerts?.email || {}) },
      webhook: { ...DEFAULT_CONFIG.alerts.webhook, ...(config.alerts?.webhook || {}) },
      sound: { ...DEFAULT_CONFIG.alerts.sound, ...(config.alerts?.sound || {}) }
    }
  };
}

/**
 * 导出配置为 JSON
 */
export function exportConfig(config) {
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `log-monitor-config-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 导入配置
 */
export async function importConfig(file) {
  try {
    const text = await file.text();
    const config = JSON.parse(text);
    return saveConfig(config);
  } catch (error) {
    console.error('导入配置失败:', error);
    return { success: false, error: '配置文件格式错误' };
  }
}

export default {
  loadConfig,
  saveConfig,
  getSettings,
  updateSettings,
  getMonitors,
  addMonitor,
  updateMonitor,
  deleteMonitor,
  getMonitor,
  exportConfig,
  importConfig
};
