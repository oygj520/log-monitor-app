import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// 性能优化配置
const CONFIG = {
  MAX_LOGS_CACHE: 10000, // 最大缓存日志数
  VISIBLE_COUNT: 30, // 可见区域日志数
  PAGE_SIZE: 100 // 每页加载数量
  // 自动刷新已改为文件监听触发，不再使用定时轮询
};

// 环形缓冲区实现 - 用于内存限制
class RingBuffer {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.buffer = [];
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }

  push(item) {
    if (this.size === this.maxSize) {
      // 缓冲区满，移除最旧的
      this.head = (this.head + 1) % this.maxSize;
      this.size--;
    }
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.maxSize;
    this.size++;
    return this;
  }

  pushMany(items) {
    for (const item of items) {
      this.push(item);
    }
    return this;
  }

  toArray() {
    const result = [];
    for (let i = 0; i < this.size; i++) {
      result.push(this.buffer[(this.head + i) % this.maxSize]);
    }
    return result;
  }

  clear() {
    this.buffer = [];
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }

  get length() {
    return this.size;
  }
}

function LogViewer() {
  // 使用环形缓冲区存储日志，限制内存使用
  const logsBufferRef = useRef(new RingBuffer(CONFIG.MAX_LOGS_CACHE));
  const [logsVersion, setLogsVersion] = useState(0); // 用于触发重渲染
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
    pageSize: CONFIG.PAGE_SIZE,
    total: 0
  });
  
  const [autoRefresh, setAutoRefresh] = useState(true); // 控制是否实时监听文件变化
  const scrollContainerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const itemHeight = 40; // 每行高度 (px)
  
  // 增量更新：记录当前已显示的最新日志时间戳
  const lastTimestampRef = useRef(null);
  // 记录是否已初始化（首次加载用全量，后续用增量）
  const isInitializedRef = useRef(false);

  // 获取当前日志数组
  const getLogs = useCallback(() => {
    return logsBufferRef.current.toArray();
  }, []);

  // 虚拟滚动：计算可见区域
  const virtualScrollData = useMemo(() => {
    const allLogs = getLogs();
    const totalHeight = allLogs.length * itemHeight;
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(startIndex + CONFIG.VISIBLE_COUNT + 5, allLogs.length); // 多渲染 5 条作为缓冲
    const visibleLogs = allLogs.slice(startIndex, endIndex);
    
    return {
      visibleLogs,
      startIndex,
      totalHeight,
      offsetY: startIndex * itemHeight
    };
  }, [logsVersion, scrollTop]);

  // 处理滚动事件
  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  // BUG-1 修复：计算分页数据
  const getPaginatedLogs = useCallback(() => {
    const allLogs = getLogs();
    const start = (pagination.page - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;
    return allLogs.slice(start, end);
  }, [logsVersion, pagination.page, pagination.pageSize]);

  // 文件监听：由后端 chokidar 检测文件变化并触发 onLogUpdate 事件
  // 无需定时轮询，节省资源

  // BUG-4 修复：loadLogs 使用当前最新的 filters 和 pagination
  // 移除 filters 和 pagination 依赖，让函数内部直接读取最新值
  const loadLogs = useCallback(async (isAutoRefresh = false) => {
    setLoading(true);
    try {
      if (window.electronAPI) {
        // 增量更新：如果有过滤器，使用全量查询；否则使用增量查询
        // 直接读取当前最新的 filters 值
        const currentFilters = filters;
        const currentPagination = pagination;
        const hasFilters = currentFilters.level || currentFilters.keyword || currentFilters.startDate || currentFilters.endDate;
        
        let result;
        if (hasFilters || !isInitializedRef.current) {
          // 全量查询：有过滤器或首次加载
          console.log('[LogViewer] 全量查询日志');
          const options = {
            page: currentPagination.page,
            pageSize: currentPagination.pageSize,
            ...currentFilters
          };
          result = await window.electronAPI.getLogs(options);
          
          // 2. 内存限制：使用环形缓冲区存储
          const newLogs = result?.logs || [];
          logsBufferRef.current.clear();
          logsBufferRef.current.pushMany(newLogs);
          setLogsVersion(prev => prev + 1);
          
          setPagination(prev => ({ 
            ...prev, 
            total: result?.total || newLogs.length
          }));
          
          // 更新最新时间戳（取最新的日志）
          if (newLogs.length > 0) {
            const maxTimestamp = newLogs.reduce((max, log) => {
              return log.timestamp > max ? log.timestamp : max;
            }, newLogs[0].timestamp);
            lastTimestampRef.current = maxTimestamp;
            console.log('[LogViewer] 更新最新时间戳（全量）:', maxTimestamp);
          }
          
          isInitializedRef.current = true;
        } else {
          // 增量查询：自动刷新时使用
          console.log('[LogViewer] 增量查询日志，lastTimestamp:', lastTimestampRef.current);
          result = await window.electronAPI.getIncrementalLogs({
            lastTimestamp: lastTimestampRef.current
          });
          
          const newLogs = result?.logs || [];
          if (newLogs.length > 0) {
            console.log('[LogViewer] 收到', newLogs.length, '条增量日志');
            
            // 追加新日志到缓冲区
            logsBufferRef.current.pushMany(newLogs);
            setLogsVersion(prev => prev + 1);
            
            // 更新最新时间戳
            if (result.lastTimestamp) {
              lastTimestampRef.current = result.lastTimestamp;
              console.log('[LogViewer] 更新最新时间戳（增量）:', result.lastTimestamp);
            }
            
            setPagination(prev => ({ 
              ...prev, 
              total: logsBufferRef.current.length
            }));
          }
        }
      }
    } catch (error) {
      console.error('加载日志失败:', error);
    } finally {
      setLoading(false);
    }
  }, []); // 移除 filters 和 pagination 依赖，只在组件卸载时清理

  // 初始化加载
  useEffect(() => {
    loadLogs();
    
    if (window.electronAPI && window.electronAPI.onLogUpdate) {
      const unsubscribe = window.electronAPI.onLogUpdate((data) => {
        console.log('[文件监听触发] 收到日志更新:', data);
        const hasFilters = filters.level || filters.keyword || filters.startDate || filters.endDate;
        
        // 只有在开启自动刷新且没有过滤器时才处理实时更新
        if (autoRefresh && !hasFilters) {
          // 增量更新：追加新日志
          const newLogs = data.logs || [];
          if (newLogs.length > 0) {
            logsBufferRef.current.pushMany(newLogs);
            setLogsVersion(prev => prev + 1);
            
            // 更新最新时间戳
            if (newLogs.length > 0) {
              const maxTimestamp = newLogs.reduce((max, log) => {
                return log.timestamp > max ? log.timestamp : max;
              }, lastTimestampRef.current || newLogs[0].timestamp);
              lastTimestampRef.current = maxTimestamp;
            }
            
            setPagination(prev => ({ ...prev, total: logsBufferRef.current.length }));
            console.log('[LogViewer] 通过 onLogUpdate 追加', newLogs.length, '条日志');
          }
        }
      });
      
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, []);

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
    setAutoRefresh(prev => !prev);
  };

  const getLevelClass = (level) => {
    return `log-level ${level.toUpperCase()}`;
  };

  // 1. 虚拟滚动：渲染可见区域
  const renderVirtualList = () => {
    const { visibleLogs, startIndex, totalHeight, offsetY } = virtualScrollData;
    
    return (
      <div 
        className="virtual-scroll-container"
        style={{ 
          height: '600px', 
          overflow: 'auto',
          position: 'relative'
        }}
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div style={{ 
            position: 'absolute', 
            top: offsetY, 
            left: 0, 
            right: 0 
          }}>
            {visibleLogs.map((log, index) => (
              <tr 
                key={`${log.timestamp}-${log.message}-${log.source}-${startIndex + index}`}
                style={{ height: `${itemHeight}px` }}
              >
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
          </div>
        </div>
      </div>
    );
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
            {autoRefresh ? '📡 实时监听已开启' : '📴 实时监听已关闭'}
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
            (共 {logsBufferRef.current.length} 条，缓存上限：{CONFIG.MAX_LOGS_CACHE})
          </span>
        </div>

        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        ) : logsBufferRef.current.length > 0 ? (
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
                {/* 1. 虚拟滚动：只渲染可见区域 */}
                {renderVirtualList()}
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
                第 {pagination.page} 页，每页 {pagination.pageSize} 条，共 {Math.ceil(logsBufferRef.current.length / pagination.pageSize) || 1} 页
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn"
                  disabled={pagination.page === 1}
                  onClick={() => {
                    setPagination(prev => ({ ...prev, page: prev.page - 1 }));
                    setScrollTop(0);
                  }}
                >
                  上一页
                </button>
                <button
                  className="btn"
                  disabled={pagination.page >= Math.ceil(logsBufferRef.current.length / pagination.pageSize)}
                  onClick={() => {
                    setPagination(prev => ({ ...prev, page: prev.page + 1 }));
                    setScrollTop(0);
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
