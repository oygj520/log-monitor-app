import React, { useState, useEffect } from 'react';

function Settings() {
  const [settings, setSettings] = useState({
    dataPath: 'E:\\LogMonitor\\data',
    autoStart: false,
    minimizeToTray: true,
    notificationEnabled: true,
    logRetentionDays: 30,
    refreshInterval: 5
  });
  const [systemInfo, setSystemInfo] = useState({
    appPath: '',
    dataPath: '',
    configPath: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSystemInfo();
    loadSettings();
  }, []);

  const loadSystemInfo = async () => {
    try {
      if (window.electronAPI) {
        const [appPath, dataPath, configPath] = await Promise.all([
          window.electronAPI.getAppPath(),
          window.electronAPI.getDataPath(),
          window.electronAPI.getConfigPath()
        ]);
        setSystemInfo({ appPath, dataPath, configPath });
      }
    } catch (error) {
      console.error('加载系统信息失败:', error);
    }
  };

  const loadSettings = async () => {
    try {
      if (window.electronAPI) {
        const config = await window.electronAPI.loadConfig();
        if (config && config.settings) {
          setSettings(prev => ({ ...prev, ...config.settings }));
        }
      }
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (window.electronAPI) {
        const config = await window.electronAPI.loadConfig();
        const newConfig = {
          ...config,
          settings
        };
        await window.electronAPI.saveConfig(newConfig);
        alert('设置已保存');
      }
    } catch (error) {
      console.error('保存设置失败:', error);
      alert('保存失败：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExportConfig = async () => {
    try {
      if (window.electronAPI) {
        const config = await window.electronAPI.loadConfig();
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `log-monitor-config-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        alert('配置已导出');
      }
    } catch (error) {
      console.error('导出配置失败:', error);
      alert('导出失败：' + error.message);
    }
  };

  const handleImportConfig = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      try {
        const file = e.target.files[0];
        if (!file) return;
        
        const text = await file.text();
        const config = JSON.parse(text);
        
        if (window.electronAPI) {
          await window.electronAPI.saveConfig(config);
          loadSettings();
          alert('配置已导入');
        }
      } catch (error) {
        console.error('导入配置失败:', error);
        alert('导入失败：' + error.message);
      }
    };
    input.click();
  };

  const handleClearData = () => {
    if (!confirm('确定要清空所有数据吗？此操作不可恢复！')) return;
    
    // 这里可以调用 Electron API 来清空数据库
    alert('数据清空功能开发中');
  };

  return (
    <div>
      <div className="card">
        <div className="card-title">系统信息</div>
        <div style={{ fontSize: '14px', lineHeight: '2' }}>
          <div><strong>应用路径:</strong> {systemInfo.appPath || '加载中...'}</div>
          <div><strong>数据路径:</strong> {systemInfo.dataPath || '加载中...'}</div>
          <div><strong>配置路径:</strong> {systemInfo.configPath || '加载中...'}</div>
          <div style={{ marginTop: '12px', padding: '12px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: '6px' }}>
            ✅ 所有数据存储在 E 盘，不会占用 C 盘空间
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">常规设置</div>
        
        <div className="form-group">
          <label className="form-label">数据保存路径</label>
          <input
            type="text"
            className="form-input"
            value={settings.dataPath}
            onChange={(e) => setSettings(prev => ({ ...prev, dataPath: e.target.value }))}
          />
          <div className="form-help">建议保持在 E 盘以避免占用系统盘</div>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.autoStart}
              onChange={(e) => setSettings(prev => ({ ...prev, autoStart: e.target.checked }))}
            />
            开机自动启动
          </label>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.minimizeToTray}
              onChange={(e) => setSettings(prev => ({ ...prev, minimizeToTray: e.target.checked }))}
            />
            最小化到系统托盘
          </label>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.notificationEnabled}
              onChange={(e) => setSettings(prev => ({ ...prev, notificationEnabled: e.target.checked }))}
            />
            启用告警通知
          </label>
        </div>
      </div>

      <div className="card">
        <div className="card-title">性能设置</div>
        
        <div className="form-group">
          <label className="form-label">日志保留天数</label>
          <input
            type="number"
            className="form-input"
            value={settings.logRetentionDays}
            onChange={(e) => setSettings(prev => ({ ...prev, logRetentionDays: parseInt(e.target.value) || 30 }))}
            min="1"
            max="365"
          />
          <div className="form-help">超过此天数的日志将被自动清理（1-365 天）</div>
        </div>

        <div className="form-group">
          <label className="form-label">数据刷新间隔（秒）</label>
          <input
            type="number"
            className="form-input"
            value={settings.refreshInterval}
            onChange={(e) => setSettings(prev => ({ ...prev, refreshInterval: parseInt(e.target.value) || 5 }))}
            min="1"
            max="60"
          />
          <div className="form-help">仪表盘和日志列表的自动刷新间隔（1-60 秒）</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">数据管理</div>
        
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={handleExportConfig}>
            📤 导出配置
          </button>
          <button className="btn" onClick={handleImportConfig}>
            📥 导入配置
          </button>
          <button className="btn btn-danger" onClick={handleClearData}>
            🗑️ 清空数据
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">关于</div>
        <div style={{ fontSize: '14px', lineHeight: '1.8', color: '#666' }}>
          <div><strong>应用名称:</strong> LogMonitor 日志监控系统</div>
          <div><strong>版本:</strong> v1.0.0</div>
          <div><strong>技术栈:</strong> Electron + React</div>
          <div><strong>开发团队:</strong> OpenClaw Team</div>
          <div style={{ marginTop: '12px' }}>
            功能特性：
            <ul style={{ marginLeft: '20px', marginTop: '8px' }}>
              <li>实时监控多个日志文件</li>
              <li>自动识别日志格式</li>
              <li>灵活的过滤和搜索</li>
              <li>智能告警通知</li>
              <li>可视化统计分析</li>
              <li>跨平台支持（Windows/Linux）</li>
            </ul>
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '24px' }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : '💾 保存设置'}
        </button>
      </div>
    </div>
  );
}

export default Settings;
