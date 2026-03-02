import React, { useState, useEffect } from 'react';

function MonitorConfig() {
  const [monitors, setMonitors] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    paths: [],
    alertKeywords: ['ERROR', 'FATAL', 'CRITICAL'],
    customKeywords: []
  });
  const [pathInput, setPathInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');

  useEffect(() => {
    loadMonitors();
  }, []);

  const loadMonitors = async () => {
    try {
      if (window.electronAPI) {
        const configs = await window.electronAPI.loadConfig();
        if (configs && configs.monitors) {
          setMonitors(configs.monitors);
        }
      }
    } catch (error) {
      console.error('加载监控配置失败:', error);
    }
  };

  const handleOpenModal = (monitor = null) => {
    if (monitor) {
      setEditingId(monitor.id);
      setFormData({
        name: monitor.name,
        paths: monitor.paths,
        alertKeywords: monitor.alertKeywords || ['ERROR', 'FATAL', 'CRITICAL'],
        customKeywords: monitor.customKeywords || []
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        paths: [],
        alertKeywords: ['ERROR', 'FATAL', 'CRITICAL'],
        customKeywords: []
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  const handleAddPath = async () => {
    if (pathInput.trim()) {
      setFormData(prev => ({
        ...prev,
        paths: [...prev.paths, pathInput.trim()]
      }));
      setPathInput('');
    }
  };

  const handleSelectFiles = async () => {
    try {
      if (window.electronAPI) {
        const files = await window.electronAPI.selectFiles();
        if (files && files.length > 0) {
          setFormData(prev => ({
            ...prev,
            paths: [...prev.paths, ...files]
          }));
        }
      }
    } catch (error) {
      console.error('选择文件失败:', error);
    }
  };

  const handleSelectFolder = async () => {
    try {
      if (window.electronAPI) {
        const folders = await window.electronAPI.selectFolder();
        if (folders && folders.length > 0) {
          setFormData(prev => ({
            ...prev,
            paths: [...prev.paths, ...folders]
          }));
        }
      }
    } catch (error) {
      console.error('选择文件夹失败:', error);
    }
  };

  const handleRemovePath = (index) => {
    setFormData(prev => ({
      ...prev,
      paths: prev.paths.filter((_, i) => i !== index)
    }));
  };

  const handleAddKeyword = () => {
    if (keywordInput.trim()) {
      setFormData(prev => ({
        ...prev,
        customKeywords: [...prev.customKeywords, keywordInput.trim()]
      }));
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (index) => {
    setFormData(prev => ({
      ...prev,
      customKeywords: prev.customKeywords.filter((_, i) => i !== index)
    }));
  };

  const handleToggleAlertKeyword = (keyword) => {
    setFormData(prev => ({
      ...prev,
      alertKeywords: prev.alertKeywords.includes(keyword)
        ? prev.alertKeywords.filter(k => k !== keyword)
        : [...prev.alertKeywords, keyword]
    }));
  };

  const handleSubmit = async () => {
    try {
      if (!formData.name.trim()) {
        alert('请输入监控名称');
        return;
      }
      if (formData.paths.length === 0) {
        alert('请至少添加一个监控路径');
        return;
      }

      const monitorData = {
        id: editingId || Date.now().toString(),
        ...formData,
        status: 'stopped',
        createdAt: editingId ? undefined : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 保存配置
      if (window.electronAPI) {
        const existingConfig = await window.electronAPI.loadConfig();
        const config = existingConfig || { monitors: [] };
        
        if (editingId) {
          config.monitors = config.monitors.map(m => 
            m.id === editingId ? monitorData : m
          );
        } else {
          config.monitors = [...config.monitors, monitorData];
        }

        await window.electronAPI.saveConfig(config);
      }

      handleCloseModal();
      loadMonitors();
      alert('保存成功');
    } catch (error) {
      console.error('保存配置失败:', error);
      alert('保存失败：' + error.message);
    }
  };

  const handleDeleteMonitor = async (id) => {
    if (!confirm('确定要删除这个监控配置吗？')) return;

    try {
      if (window.electronAPI) {
        const existingConfig = await window.electronAPI.loadConfig();
        if (existingConfig && existingConfig.monitors) {
          existingConfig.monitors = existingConfig.monitors.filter(m => m.id !== id);
          await window.electronAPI.saveConfig(existingConfig);
          loadMonitors();
        }
      }
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败：' + error.message);
    }
  };

  const handleStartMonitor = async (monitor) => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.startMonitoring(monitor);
        if (result.success) {
          alert('监控已启动');
        } else {
          alert('启动失败：' + result.error);
        }
      }
    } catch (error) {
      console.error('启动监控失败:', error);
      alert('启动失败：' + error.message);
    }
  };

  const handleStopMonitor = async (id) => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.stopMonitoring(id);
        alert('监控已停止');
      }
    } catch (error) {
      console.error('停止监控失败:', error);
      alert('停止失败：' + error.message);
    }
  };

  return (
    <div>
      <div className="card">
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>监控配置列表</span>
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            ➕ 新建监控
          </button>
        </div>

        {monitors.length > 0 ? (
          monitors.map(monitor => (
            <div key={monitor.id} className="monitor-item">
              <div className="monitor-info">
                <div className="monitor-name">{monitor.name}</div>
                <div className="monitor-paths">
                  {monitor.paths.slice(0, 2).join(', ')}
                  {monitor.paths.length > 2 && ` 等${monitor.paths.length}个路径`}
                </div>
                <div style={{ marginTop: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#666' }}>
                    告警级别：{monitor.alertKeywords?.join(', ')}
                  </span>
                  {monitor.customKeywords?.length > 0 && (
                    <span style={{ fontSize: '12px', color: '#666', marginLeft: '16px' }}>
                      关键字：{monitor.customKeywords.join(', ')}
                    </span>
                  )}
                </div>
              </div>
              <div className="monitor-actions">
                <button 
                  className="btn btn-success"
                  onClick={() => handleStartMonitor(monitor)}
                >
                  ▶️ 启动
                </button>
                <button 
                  className="btn btn-danger"
                  onClick={() => handleStopMonitor(monitor.id)}
                >
                  ⏹️ 停止
                </button>
                <button 
                  className="btn"
                  onClick={() => handleOpenModal(monitor)}
                >
                  ✏️ 编辑
                </button>
                <button 
                  className="btn btn-danger"
                  onClick={() => handleDeleteMonitor(monitor.id)}
                >
                  🗑️ 删除
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">⚙️</div>
            <div className="empty-state-text">暂无监控配置</div>
            <button className="btn btn-primary" onClick={() => handleOpenModal()}>
              创建第一个监控
            </button>
          </div>
        )}
      </div>

      {/* 新建/编辑弹窗 */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                {editingId ? '编辑监控配置' : '新建监控配置'}
              </div>
              <button className="modal-close" onClick={handleCloseModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">监控名称</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="例如：应用日志监控"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">监控路径</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="输入文件路径或使用选择按钮"
                    value={pathInput}
                    onChange={(e) => setPathInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddPath()}
                  />
                  <button className="btn" onClick={handleAddPath}>添加</button>
                  <button className="btn" onClick={handleSelectFiles}>📁 选择文件</button>
                  <button className="btn" onClick={handleSelectFolder}>📂 选择文件夹</button>
                </div>
                <div>
                  {formData.paths.map((path, index) => (
                    <span key={index} className="tag tag-removable" onClick={() => handleRemovePath(index)}>
                      {path} ×
                    </span>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">告警级别</label>
                <div>
                  {['ERROR', 'FATAL', 'CRITICAL', 'WARN', 'WARNING'].map(level => (
                    <span
                      key={level}
                      className={`tag tag-removable ${formData.alertKeywords.includes(level) ? '' : ''}`}
                      style={{
                        background: formData.alertKeywords.includes(level) ? '#fff1f0' : '#f0f0f0',
                        color: formData.alertKeywords.includes(level) ? '#f5222d' : '#333'
                      }}
                      onClick={() => handleToggleAlertKeyword(level)}
                    >
                      {level} {formData.alertKeywords.includes(level) ? '✓' : '+'}
                    </span>
                  ))}
                </div>
                <div className="form-help">点击添加或移除告警级别</div>
              </div>

              <div className="form-group">
                <label className="form-label">自定义关键字</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="输入关键字"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddKeyword()}
                  />
                  <button className="btn" onClick={handleAddKeyword}>添加</button>
                </div>
                <div>
                  {formData.customKeywords.map((keyword, index) => (
                    <span key={index} className="tag tag-removable" onClick={() => handleRemoveKeyword(index)}>
                      {keyword} ×
                    </span>
                  ))}
                </div>
                <div className="form-help">当日志包含这些关键字时会触发告警</div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={handleCloseModal}>取消</button>
              <button className="btn btn-primary" onClick={handleSubmit}>
                {editingId ? '保存修改' : '创建监控'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MonitorConfig;
