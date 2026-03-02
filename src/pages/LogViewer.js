import React, { useState, useEffect, useRef, useCallback } from 'react';

function LogViewer() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    level: '',
    keyword: '',
    startDate: '',
    endDate: '',
    source: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 50,
    total: 0
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const logsRef = useRef(logs);
  const refreshKeyRef = useRef(0); // 用于强制刷新的 key
  
  // 保持 logsRef 同步
  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  // 计算分页数据
  const getPaginatedLogs = useCallback(() => {
    const start = (pagination.page - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;
    return logs.slice(start, end);
  }, [logs, pagination.page, pagination.pageSize]);

  useEffect(() => {
    loadLogs();
    
    // 监听日志更新事件
    if (window.electronAPI && window.electronAPI.onLogUpdate) {
      window.electronAPI.onLogUpdate((data) => {
        console.log('收到日志更新:', data);
        if (autoRefresh && (!filters.level && !filters.keyword && !filters.startDate && !filters.endDate)) {
          // 只有在没有过滤条件时才自动追加新日志
          setLogs(prev => {
            const newLogs = [...(data.logs || []), ...prev];
            // 去重 - 使用新的数据替换旧数据
            const uniqueLogs = Array.from(
              new Map(newLogs.map(log => [`${log.timestamp}-${log.message}`, log])).values()
            ).slice(0, 1000); // 最多保留 1000 条
            return uniqueLogs;
          });
          // 更新分页总数
          setPagination(prev => ({ ...prev, total: data.logs?.length || 0 }));
        }
      });
    }
    
    return () => {
      // 清理监听器
    };
  }, [autoRefresh, filters]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      if (window.electronAPI) {
        const options = {
          page: pagination.page,
          pageSize: pagination.pageSize,
          ...filters
        };
        const result = await window.electronAPI.getLogs(options);
        // 确保每次加载都创建新的数组引用，触发重新渲染
        setLogs(result ? [...result] : []);
        // 更新总数
        setPagination(prev => ({ 
          ...prev, 
          total: result?.length || 0,
          page: result?.length === 0 && prev.page > 1 ? prev.page - 1 : prev.page
        }));
      }
    } catch (error) {
      console.error('加载日志失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    loadLogs();
  };

  const handleClearFilters = () => {
    setFilters({
      level: '',
      keyword: '',
      startDate: '',
      endDate: '',
      source: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  const getLevelClass = (level) => {
    return `log-level ${level.toUpperCase()}`;
  };

  return (
    <div>
      <div className="card">
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>日志过滤</span>
          <button
            className={`btn ${autoRefresh ? 'btn-success' : ''}`}
            onClick={toggleAutoRefresh}
            style={{ fontSize: '12px', padding: '4px 12px' }}
          >
            {autoRefresh ? '🔔 自动刷新已开启' : '🔕 自动刷新已关闭'}
          </button>
        </div>
        <div className="filter-bar">
          <div className="filter-item">
            <label>级别:</label>
            <select
              className="select"
              value={filters.level}
              onChange={(e) => handleFilterChange('level', e.target.value)}
            >
              <option value="">全部</option>
              <option value="ERROR">ERROR</option>
              <option value="WARN">WARN</option>
              <option value="INFO">INFO</option>
              <option value="DEBUG">DEBUG</option>
            </select>
          </div>

          <div className="filter-item">
            <label>关键字:</label>
            <input
              type="text"
              className="input"
              placeholder="搜索日志内容..."
              value={filters.keyword}
              onChange={(e) => handleFilterChange('keyword', e.target.value)}
              style={{ width: '200px' }}
            />
          </div>

          <div className="filter-item">
            <label>开始时间:</label>
            <input
              type="datetime-local"
              className="input"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>

          <div className="filter-item">
            <label>结束时间:</label>
            <input
              type="datetime-local"
              className="input"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>

          <button className="btn btn-primary" onClick={handleSearch}>
            🔍 搜索
          </button>
          <button className="btn" onClick={handleClearFilters}>
            🔄 清空
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          日志列表 
          <span style={{ fontSize: '12px', color: '#999', marginLeft: '8px' }}>
            (共 {logs.length} 条)
          </span>
        </div>

        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        ) : logs.length > 0 ? (
          <>
            <table className="log-table">
              <thead>
                <tr>
                  <th style={{ width: '180px' }}>时间</th>
                  <th style={{ width: '80px' }}>级别</th>
                  <th style={{ width: '150px' }}>来源</th>
                  <th>消息</th>
                </tr>
              </thead>
              <tbody>
                {getPaginatedLogs().map((log, index) => (
                  <tr key={`${log.timestamp}-${log.message}-${index}`}>
                    <td>{new Date(log.timestamp).toLocaleString()}</td>
                    <td>
                      <span className={getLevelClass(log.level)}>
                        {log.level}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: '#666' }}>
                      {log.source}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                      {log.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 分页 */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid #eee'
            }}>
              <div style={{ fontSize: '13px', color: '#666' }}>
                第 {pagination.page} 页，每页 {pagination.pageSize} 条，共 {Math.ceil(logs.length / pagination.pageSize)} 页
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn"
                  disabled={pagination.page === 1}
                  onClick={() => {
                    setPagination(prev => ({ ...prev, page: prev.page - 1 }));
                    loadLogs();
                  }}
                >
                  上一页
                </button>
                <button
                  className="btn"
                  disabled={pagination.page >= Math.ceil(logs.length / pagination.pageSize)}
                  onClick={() => {
                    setPagination(prev => ({ ...prev, page: prev.page + 1 }));
                    loadLogs();
                  }}
                >
                  下一页
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">📝</div>
            <div className="empty-state-text">暂无日志数据</div>
            <div>请确保已配置监控任务并正在运行</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LogViewer;
