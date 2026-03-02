import React, { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';

function Dashboard({ stats }) {
  const [monitorStatus, setMonitorStatus] = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [chartData, setChartData] = useState({
    byLevel: [],
    timeTrend: []
  });

  useEffect(() => {
    loadMonitorStatus();
    loadChartData();
    
    const interval = setInterval(() => {
      loadMonitorStatus();
      loadChartData();
    }, 10000);

    // 监听监控状态变化
    if (window.electronAPI && window.electronAPI.onMonitoringStatusChange) {
      window.electronAPI.onMonitoringStatusChange((status) => {
        console.log('监控状态变化:', status);
        setMonitorStatus(status);
      });
    }
    
    // 监听告警
    if (window.electronAPI && window.electronAPI.onAlert) {
      window.electronAPI.onAlert((alert) => {
        console.log('收到告警:', alert);
        setRecentAlerts(prev => [alert, ...prev].slice(0, 10));
      });
    }

    return () => clearInterval(interval);
  }, []);

  const loadMonitorStatus = async () => {
    try {
      if (window.electronAPI) {
        const status = await window.electronAPI.getMonitoringStatus();
        setMonitorStatus(status);
      }
    } catch (error) {
      console.error('加载监控状态失败:', error);
    }
  };

  const loadChartData = async () => {
    try {
      if (window.electronAPI) {
        const statistics = await window.electronAPI.getLogStatistics({});
        setChartData({
          byLevel: statistics.byLevel || [],
          timeTrend: statistics.timeTrend || []
        });
      }
    } catch (error) {
      console.error('加载图表数据失败:', error);
    }
  };

  const levelChartOption = {
    title: { text: '日志级别分布', left: 'center' },
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'pie',
        radius: '50%',
        data: chartData.byLevel.map(item => ({
          value: item.count,
          name: item.level
        })),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        },
        color: ['#f5222d', '#fa8c16', '#1890ff', '#52c41a', '#722ed1']
      }
    ]
  };

  const timeChartOption = {
    title: { text: '日志时间趋势', left: 'center' },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: chartData.timeTrend.map(item => item.hour).reverse()
    },
    yAxis: { type: 'value' },
    series: [
      {
        data: chartData.timeTrend.map(item => item.count).reverse(),
        type: 'line',
        smooth: true,
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(24, 144, 255, 0.5)' },
            { offset: 1, color: 'rgba(24, 144, 255, 0.1)' }
          ])
        },
        itemStyle: { color: '#1890ff' }
      }
    ]
  };

  const handleStartMonitor = async (id) => {
    try {
      if (window.electronAPI) {
        // 这里需要从配置中获取监控配置
        alert('启动监控功能开发中');
      }
    } catch (error) {
      console.error('启动监控失败:', error);
    }
  };

  const handleStopMonitor = async (id) => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.stopMonitoring(id);
        loadMonitorStatus();
      }
    } catch (error) {
      console.error('停止监控失败:', error);
    }
  };

  return (
    <div>
      {/* 统计卡片 */}
      <div className="stat-grid">
        <div className="stat-card blue">
          <div className="stat-value">{stats.totalLogs.toLocaleString()}</div>
          <div className="stat-label">总日志数</div>
        </div>
        <div className="stat-card green">
          <div className="stat-value">{monitorStatus.filter(m => m.status === 'running').length}</div>
          <div className="stat-label">运行中监控</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-value">{stats.alertsToday}</div>
          <div className="stat-label">今日告警</div>
        </div>
        <div className="stat-card red">
          <div className="stat-value">{stats.errorRate}%</div>
          <div className="stat-label">错误率</div>
        </div>
      </div>

      {/* 图表区域 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <div className="card">
          <div className="card-title">日志级别分布</div>
          <div className="chart-container">
            {chartData.byLevel.length > 0 ? (
              <ReactECharts option={levelChartOption} style={{ height: '100%' }} />
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📊</div>
                <div className="empty-state-text">暂无数据</div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-title">日志时间趋势</div>
          <div className="chart-container">
            {chartData.timeTrend.length > 0 ? (
              <ReactECharts option={timeChartOption} style={{ height: '100%' }} />
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📈</div>
                <div className="empty-state-text">暂无数据</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 监控状态 */}
      <div className="card">
        <div className="card-title">监控状态</div>
        {monitorStatus.length > 0 ? (
          monitorStatus.map(monitor => (
            <div key={monitor.id} className="monitor-item">
              <div className="monitor-info">
                <div className="monitor-name">监控任务 #{monitor.id.slice(0, 8)}</div>
                <div className="monitor-paths">
                  {monitor.paths?.slice(0, 3).join(', ')}
                  {monitor.paths?.length > 3 && '...'}
                </div>
              </div>
              <div>
                <span className={`monitor-status ${monitor.status}`}>
                  {monitor.status === 'running' ? '● 运行中' : '○ 已停止'}
                </span>
              </div>
              <div className="monitor-actions">
                {monitor.status === 'running' ? (
                  <button 
                    className="btn btn-danger"
                    onClick={() => handleStopMonitor(monitor.id)}
                  >
                    停止
                  </button>
                ) : (
                  <button 
                    className="btn btn-success"
                    onClick={() => handleStartMonitor(monitor.id)}
                  >
                    启动
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">⚙️</div>
            <div className="empty-state-text">暂无监控任务</div>
            <div>请前往"监控配置"页面添加监控</div>
          </div>
        )}
      </div>

      {/* 最近告警 */}
      <div className="card">
        <div className="card-title">最近告警</div>
        {recentAlerts.length > 0 ? (
          recentAlerts.map(alert => (
            <div key={alert.id} className="alert-banner">
              <span className="alert-icon">⚠️</span>
              <span className="alert-message">{alert.message}</span>
              <span style={{ fontSize: '12px', color: '#999' }}>
                {new Date(alert.createdAt).toLocaleString()}
              </span>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            <div className="empty-state-text">暂无告警</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
