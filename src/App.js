import React, { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import LogViewer from './pages/LogViewer';
import MonitorConfig from './pages/MonitorConfig';
import Settings from './pages/Settings';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [globalStats, setGlobalStats] = useState({
    totalLogs: 0,
    activeMonitors: 0,
    alertsToday: 0,
    errorRate: 0
  });

  // 导航菜单
  const menuItems = [
    { key: 'dashboard', label: '仪表盘', icon: '📊' },
    { key: 'logs', label: '日志查看', icon: '📝' },
    { key: 'monitors', label: '监控配置', icon: '⚙️' },
    { key: 'settings', label: '系统设置', icon: '🔧' }
  ];

  // 加载全局统计数据
  useEffect(() => {
    loadGlobalStats();
    const interval = setInterval(loadGlobalStats, 30000); // 每 30 秒更新
    return () => clearInterval(interval);
  }, []);

  const loadGlobalStats = async () => {
    try {
      if (window.electronAPI) {
        const stats = await window.electronAPI.getLogStatistics({});
        setGlobalStats({
          totalLogs: stats.total || 0,
          activeMonitors: 0, // 从监控状态获取
          alertsToday: 0,
          errorRate: calculateErrorRate(stats.byLevel)
        });
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  };

  const calculateErrorRate = (byLevel) => {
    if (!byLevel || byLevel.length === 0) return 0;
    const total = byLevel.reduce((sum, item) => sum + item.count, 0);
    const errors = byLevel
      .filter(item => ['ERROR', 'FATAL', 'CRITICAL'].includes(item.level))
      .reduce((sum, item) => sum + item.count, 0);
    return total > 0 ? ((errors / total) * 100).toFixed(2) : 0;
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard stats={globalStats} />;
      case 'logs':
        return <LogViewer />;
      case 'monitors':
        return <MonitorConfig />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard stats={globalStats} />;
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🔍 日志监控系统</h1>
        <div className="subtitle">实时监控 · 智能告警 · 数据分析</div>
      </header>

      <nav style={{ 
        background: 'white', 
        padding: '12px 24px', 
        borderBottom: '1px solid #eee',
        display: 'flex',
        gap: '8px'
      }}>
        {menuItems.map(item => (
          <button
            key={item.key}
            onClick={() => setCurrentPage(item.key)}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: currentPage === item.key ? '#e6f7ff' : 'transparent',
              color: currentPage === item.key ? '#1890ff' : '#666',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.3s'
            }}
          >
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <main className="app-content">
        {renderPage()}
      </main>

      <footer style={{
        background: 'white',
        padding: '12px 24px',
        borderTop: '1px solid #eee',
        textAlign: 'center',
        fontSize: '12px',
        color: '#999'
      }}>
        LogMonitor v1.0.0 | © 2024 OpenClaw Team
      </footer>
    </div>
  );
}

export default App;
