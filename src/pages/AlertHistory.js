import React, { useState, useEffect } from 'react';

function AlertHistory() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({
    type: '',
    level: '',
    monitorId: ''
  });
  const [statistics, setStatistics] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    loadAlerts();
    loadStatistics();
  }, []);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      if (window.electronAPI) {
        const data = await window.electronAPI.getAlertHistory({
          page: 1,
          pageSize: 100,
          ...filter
        });
        setAlerts(data || []);
      }
    } catch (error) {
      console.error('加载告警历史失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      if (window.electronAPI) {
        const stats = await window.electronAPI.getAlertStatistics(
          dateRange.startDate || null,
          dateRange.endDate || null
        );
        setStatistics(stats);
      }
    } catch (error) {
      console.error('加载告警统计失败:', error);
    }
  };

  const handleAcknowledge = async (alertId) => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.acknowledgeAlert(alertId);
        if (result.success) {
          alert('告警已确认');
          loadAlerts();
        }
      }
    } catch (error) {
      console.error('确认告警失败:', error);
      alert('确认失败：' + error.message);
    }
  };

  const handleExportRules = async () => {
    try {
      if (window.electronAPI) {
        const rules = await window.electronAPI.exportAlertRules();
        const blob = new Blob([rules], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `alert-rules-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        alert('告警规则已导出');
      }
    } catch (error) {
      console.error('导出告警规则失败:', error);
      alert('导出失败：' + error.message);
    }
  };

  const handleImportRules = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      try {
        const file = e.target.files[0];
        if (!file) return;
        
        const text = await file.text();
        
        if (window.electronAPI) {
          const result = await window.electronAPI.importAlertRules(text);
          if (result.success) {
            alert('告警规则已导入');
          } else {
            alert('导入失败：' + result.error);
          }
        }
      } catch (error) {
        console.error('导入告警规则失败:', error);
        alert('导入失败：' + error.message);
      }
    };
    input.click();
  };

  const getLevelColor = (level) => {
    const colors = {
      'ERROR': '#ff4d4f',
      'FATAL': '#722ed1',
      'CRITICAL': '#fa8c16',
      'WARNING': '#faad14',
      'WARN': '#faad14',
      'INFO': '#1890ff'
    };
    return colors[level] || '#666';
  };

  const getTypeLabel = (type) => {
    const labels = {
      'level': '级别告警',
      'keyword': '关键字告警',
      'frequency': '频率告警',
      'error': '系统错误'
    };
    return labels[type] || type;
  };

  return (
    <div>
      {/* 统计卡片 */}
      {statistics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div className="card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{statistics.total}</div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>总告警数</div>
          </div>
          <div className="card" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
              {statistics.byType?.keyword || 0}
            </div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>关键字告警</div>
          </div>
          <div className="card" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
              {statistics.byType?.level || 0}
            </div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>级别告警</div>
          </div>
          <div className="card" style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', color: 'white' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
              {statistics.byType?.frequency || 0}
            </div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>频率告警</div>
          </div>
        </div>
      )}

      {/* 筛选和操作 */}
      <div className="card">
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>告警历史</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn" onClick={handleExportRules}>📤 导出规则</button>
            <button className="btn" onClick={handleImportRules}>📥 导入规则</button>
            <button className="btn btn-primary" onClick={loadAlerts}>🔄 刷新</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <select
            className="form-input"
            value={filter.type}
            onChange={(e) => setFilter(prev => ({ ...prev, type: e.target.value }))}
          >
            <option value="">全部类型</option>
            <option value="level">级别告警</option>
            <option value="keyword">关键字告警</option>
            <option value="frequency">频率告警</option>
          </select>

          <select
            className="form-input"
            value={filter.level}
            onChange={(e) => setFilter(prev => ({ ...prev, level: e.target.value }))}
          >
            <option value="">全部级别</option>
            <option value="ERROR">ERROR</option>
            <option value="FATAL">FATAL</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="WARNING">WARNING</option>
          </select>

          <input
            type="date"
            className="form-input"
            value={dateRange.startDate}
            onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
            placeholder="开始日期"
          />

          <input
            type="date"
            className="form-input"
            value={dateRange.endDate}
            onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
            placeholder="结束日期"
          />

          <button className="btn btn-primary" onClick={loadStatistics}>统计</button>
        </div>

        {loading ? (
          <div className="empty-state">加载中...</div>
        ) : alerts.length > 0 ? (
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {alerts.map((alert, index) => (
              <div
                key={alert.id || index}
                style={{
                  padding: '12px',
                  border: '1px solid #e8e8e8',
                  borderRadius: '6px',
                  marginBottom: '8px',
                  background: alert.level === 'CRITICAL' || alert.level === 'FATAL' ? '#fff1f0' : '#fafafa'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          background: getLevelColor(alert.level),
                          color: 'white'
                        }}
                      >
                        {alert.level}
                      </span>
                      <span style={{ fontSize: '12px', color: '#666' }}>
                        {getTypeLabel(alert.type)}
                      </span>
                      <span style={{ fontSize: '12px', color: '#999' }}>
                        {new Date(alert.createdAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    <div style={{ fontSize: '14px', marginBottom: '8px' }}>{alert.message}</div>
                    {alert.data && typeof alert.data === 'object' && (
                      <details style={{ fontSize: '12px', color: '#666' }}>
                        <summary>查看详情</summary>
                        <pre style={{ 
                          background: '#f5f5f5', 
                          padding: '8px', 
                          borderRadius: '4px',
                          marginTop: '8px',
                          maxHeight: '200px',
                          overflow: 'auto'
                        }}>
                          {JSON.stringify(alert.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                  <button
                    className="btn btn-success"
                    style={{ fontSize: '12px', padding: '4px 12px' }}
                    onClick={() => handleAcknowledge(alert.id)}
                  >
                    确认
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">🔔</div>
            <div className="empty-state-text">暂无告警记录</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AlertHistory;
