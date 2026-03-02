import React, { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import LogViewer from './pages/LogViewer';
import MonitorConfig from './pages/MonitorConfig';
import Settings from './pages/Settings';
import Statistics from './pages/Statistics';
import AlertHistory from './pages/AlertHistory';
import ArchiveManager from './pages/ArchiveManager';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [globalStats, setGlobalStats] = useState({
    totalLogs: 0,
    activeMonitors: 0,
    alertsToday: 0,
    errorRate: 0
  });
  const [darkMode, setDarkMode] = useState(false);
  const [healthStatus, setHealthStatus] = useState(null);
  const [bookmarks, setBookmarks] = useState([]);

  // 导航菜单
  const menuItems = [
    { key: 'dashboard', label: '仪表盘', icon: '📊' },
    { key: 'logs', label: '日志查看', icon: '📝' },
    { key: 'statistics', label: '统计分析', icon: '📈' },
    { key: 'monitors', label: '监控配置', icon: '⚙️' },
    { key: 'alerts', label: '告警历史', icon: '🔔' },
    { key: 'archives', label: '归档管理', icon: '🗄️' },
    { key: 'settings', label: '系统设置', icon: '🔧' }
  ];

  // 加载全局统计数据
  useEffect(() => {
    loadGlobalStats();
    const interval = setInterval(loadGlobalStats, 30000); // 每 30 秒更新
    return () => clearInterval(interval);
  }, []);

  // 加载主题设置
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setDarkMode(true);
      document.body.classList.add('dark-mode');
    }
    
    // 加载书签
    const savedBookmarks = localStorage.getItem('bookmarks');
    if (savedBookmarks) {
      setBookmarks(JSON.parse(savedBookmarks));
    }
  }, []);

  // 监听健康状态
  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onHealthStatus) {
      window.electronAPI.onHealthStatus((status) => {
        setHealthStatus(status);
      });
      
      // 初始加载健康状态
      window.electronAPI.getHealthStatus().then(setHealthStatus);
    }
  }, []);

  // 快捷键支持
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl/Cmd + 数字键切换页面
      if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '5') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (menuItems[index]) {
          setCurrentPage(menuItems[index].key);
        }
      }
      // Ctrl/Cmd + D 切换主题
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        toggleTheme();
      }
      // Ctrl/Cmd + R 刷新当前页面
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        loadGlobalStats();
      }
      // Ctrl/Cmd + B 添加书签
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        addBookmark();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage]);

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

  // 切换主题
  const toggleTheme = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    }
  };

  // 添加书签
  const addBookmark = () => {
    const newBookmark = {
      id: Date.now(),
      page: currentPage,
      label: menuItems.find(m => m.key === currentPage)?.label || currentPage,
      createdAt: new Date().toISOString()
    };
    const updatedBookmarks = [...bookmarks, newBookmark];
    setBookmarks(updatedBookmarks);
    localStorage.setItem('bookmarks', JSON.stringify(updatedBookmarks));
  };

  // 移除书签
  const removeBookmark = (id) => {
    const updatedBookmarks = bookmarks.filter(b => b.id !== id);
    setBookmarks(updatedBookmarks);
    localStorage.setItem('bookmarks', JSON.stringify(updatedBookmarks));
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard stats={globalStats} />;
      case 'logs':
        return <LogViewer bookmarks={bookmarks} />;
      case 'statistics':
        return <Statistics />;
      case 'monitors':
        return <MonitorConfig />;
      case 'alerts':
        return <AlertHistory />;
      case 'archives':
        return <ArchiveManager />;
      case 'settings':
        return <Settings darkMode={darkMode} toggleTheme={toggleTheme} />;
      default:
        return <Dashboard stats={globalStats} />;
    }
  };

  return (
    <div className={`app-container ${darkMode ? 'dark-mode' : ''}`}>
      <header className="app-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 24px'
      }}>
        <div>
          <h1 style={{ margin: 0 }}>🔍 日志监控系统</h1>
          <div className="subtitle" style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
            实时监控 · 智能告警 · 数据分析
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* 健康状态指示器 */}
          {healthStatus && (
            <div style={{
              display: 'flex',
              gap: '8px',
              fontSize: '12px',
              alignItems: 'center'
            }}>
              <span title="数据库状态" style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: healthStatus.database === 'connected' ? '#52c41a' : '#f5222d'
              }} />
              <span title="监控服务" style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: healthStatus.monitor === 'running' ? '#52c41a' : '#faad14'
              }} />
              <span title="API 服务" style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: healthStatus.api?.serverRunning ? '#52c41a' : '#d9d9d9'
              }} />
            </div>
          )}
          
          {/* 主题切换按钮 */}
          <button
            onClick={toggleTheme}
            title="切换主题 (Ctrl+D)"
            style={{
              padding: '6px 12px',
              border: '1px solid #d9d9d9',
              background: darkMode ? '#333' : 'white',
              color: darkMode ? 'white' : '#333',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <nav style={{ 
        background: darkMode ? '#1f1f1f' : 'white', 
        padding: '12px 24px', 
        borderBottom: '1px solid ' + (darkMode ? '#333' : '#eee'),
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap'
      }}>
        {menuItems.map((item, index) => (
          <button
            key={item.key}
            onClick={() => setCurrentPage(item.key)}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: currentPage === item.key ? (darkMode ? '#1890ff' : '#e6f7ff') : 'transparent',
              color: currentPage === item.key ? (darkMode ? 'white' : '#1890ff') : (darkMode ? '#999' : '#666'),
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.3s',
              position: 'relative'
            }}
            title={`快捷键：Ctrl+${index + 1}`}
          >
            <span>{item.icon}</span>
            {item.label}
            <span style={{
              position: 'absolute',
              top: '2px',
              right: '4px',
              fontSize: '10px',
              opacity: 0.5
            }}>
              Ctrl+{index + 1}
            </span>
          </button>
        ))}
      </nav>

      {/* 书签栏 */}
      {bookmarks.length > 0 && (
        <div style={{
          background: darkMode ? '#252525' : '#fafafa',
          padding: '8px 24px',
          borderBottom: '1px solid ' + (darkMode ? '#333' : '#eee'),
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '12px', color: '#999' }}>📑 书签:</span>
          {bookmarks.map(bookmark => (
            <span
              key={bookmark.id}
              style={{
                padding: '4px 12px',
                background: darkMode ? '#1f1f1f' : 'white',
                borderRadius: '4px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                border: '1px solid ' + (darkMode ? '#333' : '#e8e8e8')
              }}
              onClick={() => setCurrentPage(bookmark.page)}
            >
              {bookmark.label}
              <span
                onClick={(e) => { e.stopPropagation(); removeBookmark(bookmark.id); }}
                style={{
                  marginLeft: '4px',
                  cursor: 'pointer',
                  color: '#999',
                  fontSize: '14px'
                }}
              >
                ×
              </span>
            </span>
          ))}
        </div>
      )}

      <main className="app-content" style={{
        background: darkMode ? '#141414' : '#f5f5f5',
        minHeight: 'calc(100vh - 200px)'
      }}>
        {renderPage()}
      </main>

      <footer style={{
        background: darkMode ? '#1f1f1f' : 'white',
        padding: '12px 24px',
        borderTop: '1px solid ' + (darkMode ? '#333' : '#eee'),
        textAlign: 'center',
        fontSize: '12px',
        color: darkMode ? '#666' : '#999',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>LogMonitor v1.0.0 | © 2024 OpenClaw Team</div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <span title="运行时间">⏱️ {(process.uptime && process.uptime().toFixed(0)) || 0}s</span>
          <span title="快捷键帮助">⌨️ Ctrl+1-5 切换页面 | Ctrl+D 主题 | Ctrl+B 书签</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
