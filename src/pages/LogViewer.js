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
  const refreshIntervalRef = useRef(null);
  
  // BUG-1 修复：计算分页数据 - 确保正确切片
  const getPaginatedLogs = useCallback(() => {
    const start = (pagination.page - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;
    return logs.slice(start, end);
  }, [logs, pagination.page, pagination.pageSize]);

  // BUG-2 修复：独立的定时器管理
  useEffect(() => {
    // 清理旧的定时器
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    
    // 只有在 autoRefresh 为 true 时才设置定时器
    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(() => {
        console.log('自动刷新日志...');
        loadLogs(true); // 传入 isAutoRefresh 标志
      }, 5000); // 每 5 秒刷新一次
    }
    
    return () => {
      // 清理定时器
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [autoRefresh, filters, pagination.page]);

  // BUG-4 修复：loadLogs 使用当前最新的 filters 和 pagination
  const loadLogs = useCallback(async (isAutoRefresh = false) => {
    setLoading(true);
    try {
      if (window.electronAPI) {
        const options = {
          page: pagination.page,
          pageSize: pagination.pageSize,
          ...filters
        };
        const result = await window.electronAPI.getLogs(options);
        
        // BUG-3 修复：确保创建全新的数组引用，触发重新渲染
        const newLogs = result ? [...result] : [];
        setLogs(newLogs);
        
        // 更新总数 - 使用后端返回的总数或实际长度
        setPagination(prev => ({ 
          ...prev, 
          total: result?.length || 0
        }));
      }
    } catch (error) {
      console.error('加载日志失败:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.pageSize]);

  // 初始化加载
  useEffect(() => {
    loadLogs();
    
    // 监听日志更新事件
    if (window.electronAPI && window.electronAPI.onLogUpdate) {
      const unsubscribe = window.electronAPI.onLogUpdate((data) => {
        console.log('收到日志更新:', data);
        // BUG-4 修复：只有在没有过滤条件时才自动追加新日志
        const hasFilters = filters.level || filters.keyword || filters.startDate || filters.endDate;
        if (autoRefresh && !hasFilters) {
          setLogs(prev => {
            const newLogs = [...(data.logs || []), ...prev];
            // BUG-3 修复：正确的去重逻辑
            const seen = new Set();
            const uniqueLogs = newLogs.filter(log => {
              const key = `${log.timestamp}-${log.message}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            }).slice(0, 1000); // 最多保留 1000 条
            return uniqueLogs;
          });
          // 更新分页总数
          setPagination(prev => ({ ...prev, total: data.logs?.length || 0 }));
        }
      });
      
      return () => {
        // 清理监听器
        if (unsubscribe) unsubscribe();
      };
    }
  }, []); // 只在挂载时执行一次

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

  // BUG-2 修复：确保 toggleAutoRefresh 正确设置状态
  const toggleAutoRefresh = () => {
    setAutoRefresh(prev => !prev);
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
            (共 {pagination.total} 条)
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
                {/* BUG-1 & BUG-3 修复：使用分页后的数据，key 使用唯一标识 */}
                {getPaginatedLogs().map((log, index) => (
                  <tr key={`${log.timestamp}-${log.message}-${log.source}-${index}`}>
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
                第 {pagination.page} 页，每页 {pagination.pageSize} 条，共 {Math.ceil(pagination.total / pagination.pageSize) || 1} 页
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn"
                  disabled={pagination.page === 1}
                  onClick={() => {
                    setPagination(prev => ({ ...prev, page: prev.page - 1 }));
                  }}
                >
                  上一页
                </button>
                <button
                  className="btn"
                  disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize)}
                  onClick={() => {
                    setPagination(prev => ({ ...prev, page: prev.page + 1 }));
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
