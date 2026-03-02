import React, { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';

function Statistics() {
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState({
    byLevel: [],
    timeTrend: [],
    bySource: [],
    topErrors: []
  });
  const [timeRange, setTimeRange] = useState('24h');
  const [refreshInterval, setRefreshInterval] = useState(30000);

  // 加载统计数据
  useEffect(() => {
    loadStatistics();
    const interval = setInterval(loadStatistics, refreshInterval);
    return () => clearInterval(interval);
  }, [timeRange, refreshInterval]);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      if (window.electronAPI) {
        const stats = await window.electronAPI.getLogStatistics({ timeRange });
        setStatistics({
          byLevel: stats.byLevel || [],
          timeTrend: stats.timeTrend || [],
          bySource: stats.bySource || [],
          topErrors: stats.topErrors || []
        });
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 日志级别分布饼图
  const levelChartOption = {
    title: { text: '日志级别分布', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { 
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      data: statistics.byLevel.map(item => item.level)
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['60%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 5,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: true,
          formatter: '{b}: {d}%'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold'
          }
        },
        data: statistics.byLevel.map(item => ({
          value: item.count,
          name: item.level
        })),
        color: ['#f5222d', '#fa8c16', '#ff4d4f', '#1890ff', '#52c41a', '#722ed1', '#13c2c2', '#faad14']
      }
    ]
  };

  // 日志趋势折线图
  const trendChartOption = {
    title: { text: '日志时间趋势', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { 
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: statistics.timeTrend.map(item => item.hour || item.time).reverse(),
      axisLabel: { rotate: 45 }
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: '日志数量',
        type: 'line',
        smooth: true,
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(24, 144, 255, 0.5)' },
            { offset: 1, color: 'rgba(24, 144, 255, 0.1)' }
          ])
        },
        itemStyle: { color: '#1890ff' },
        lineStyle: { width: 3 },
        data: statistics.timeTrend.map(item => item.count).reverse()
      }
    ]
  };

  // 日志来源统计柱状图
  const sourceChartOption = {
    title: { text: '日志来源统计', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: statistics.bySource.slice(0, 10).map(item => {
        const name = item.source || item.path || '未知';
        return name.length > 15 ? '...' + name.slice(-12) : name;
      }),
      axisLabel: { rotate: 45, interval: 0 }
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: '日志数',
        type: 'bar',
        barWidth: '60%',
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#722ed1' },
            { offset: 1, color: '#b37feb' }
          ]),
          borderRadius: [4, 4, 0, 0]
        },
        data: statistics.bySource.slice(0, 10).map(item => item.count).reverse()
      }
    ]
  };

  // 错误排行榜配置
  const errorRankOption = {
    title: { text: '错误消息排行榜', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'funnel',
        left: '10%',
        top: 60,
        bottom: 60,
        width: '80%',
        min: 0,
        max: statistics.topErrors.length > 0 ? statistics.topErrors[0].count : 100,
        minSize: '0%',
        maxSize: '100%',
        sort: 'descending',
        gap: 2,
        label: {
          show: true,
          position: 'inside',
          formatter: '{b}: {c}'
        },
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 1
        },
        data: statistics.topErrors.slice(0, 10).map((item, index) => ({
          value: item.count,
          name: item.message?.slice(0, 50) || '未知错误',
          itemStyle: {
            color: ['#f5222d', '#ff4d4f', '#fa8c16', '#faad14', '#1890ff', 
                    '#69c0ff', '#52c41a', '#95de64', '#722ed1', '#b37feb'][index]
          }
        }))
      }
    ]
  };

  // 计算总计
  const totalLogs = statistics.byLevel.reduce((sum, item) => sum + item.count, 0);
  const errorLogs = statistics.byLevel
    .filter(item => ['ERROR', 'FATAL', 'CRITICAL'].includes(item.level))
    .reduce((sum, item) => sum + item.count, 0);
  const errorRate = totalLogs > 0 ? ((errorLogs / totalLogs) * 100).toFixed(2) : 0;

  return (
    <div className="statistics-page">
      {/* 控制栏 */}
      <div className="control-bar" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        padding: '12px 16px',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontWeight: 500 }}>时间范围:</span>
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #d9d9d9',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            <option value="1h">最近 1 小时</option>
            <option value="24h">最近 24 小时</option>
            <option value="7d">最近 7 天</option>
            <option value="30d">最近 30 天</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontWeight: 500 }}>刷新间隔:</span>
          <select 
            value={refreshInterval} 
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #d9d9d9',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            <option value={10000}>10 秒</option>
            <option value={30000}>30 秒</option>
            <option value={60000}>1 分钟</option>
            <option value={300000}>5 分钟</option>
          </select>
          <button 
            onClick={loadStatistics}
            disabled={loading}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: 'none',
              background: loading ? '#d9d9d9' : '#1890ff',
              color: 'white',
              fontSize: '14px',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {loading ? '⏳ 加载中...' : '🔄 刷新'}
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="stat-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '20px'
      }}>
        <div className="stat-card blue" style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '20px',
          borderRadius: '12px',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{totalLogs.toLocaleString()}</div>
          <div style={{ fontSize: '14px', opacity: 0.9, marginTop: '8px' }}>总日志数</div>
        </div>
        <div className="stat-card red" style={{
          background: 'linear-gradient(135deg, #f5222d 0%, #ff4d4f 100%)',
          padding: '20px',
          borderRadius: '12px',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{errorLogs.toLocaleString()}</div>
          <div style={{ fontSize: '14px', opacity: 0.9, marginTop: '8px' }}>错误日志</div>
        </div>
        <div className="stat-card orange" style={{
          background: 'linear-gradient(135deg, #fa8c16 0%, #faad14 100%)',
          padding: '20px',
          borderRadius: '12px',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{errorRate}%</div>
          <div style={{ fontSize: '14px', opacity: 0.9, marginTop: '8px' }}>错误率</div>
        </div>
        <div className="stat-card green" style={{
          background: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)',
          padding: '20px',
          borderRadius: '12px',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{statistics.bySource.length}</div>
          <div style={{ fontSize: '14px', opacity: 0.9, marginTop: '8px' }}>日志来源</div>
        </div>
      </div>

      {/* 图表区域 - 第一行 */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '20px', 
        marginBottom: '20px' 
      }}>
        <div className="card" style={{
          background: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div className="chart-container" style={{ height: '350px' }}>
            {statistics.byLevel.length > 0 ? (
              <ReactECharts option={levelChartOption} style={{ height: '100%' }} />
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📊</div>
                <div className="empty-state-text">暂无数据</div>
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{
          background: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div className="chart-container" style={{ height: '350px' }}>
            {statistics.timeTrend.length > 0 ? (
              <ReactECharts option={trendChartOption} style={{ height: '100%' }} />
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📈</div>
                <div className="empty-state-text">暂无数据</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 图表区域 - 第二行 */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '20px',
        marginBottom: '20px'
      }}>
        <div className="card" style={{
          background: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div className="chart-container" style={{ height: '350px' }}>
            {statistics.bySource.length > 0 ? (
              <ReactECharts option={sourceChartOption} style={{ height: '100%' }} />
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📁</div>
                <div className="empty-state-text">暂无数据</div>
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{
          background: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div className="chart-container" style={{ height: '350px' }}>
            {statistics.topErrors.length > 0 ? (
              <ReactECharts option={errorRankOption} style={{ height: '100%' }} />
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">⚠️</div>
                <div className="empty-state-text">暂无错误数据</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 详细数据表格 */}
      <div className="card" style={{
        background: 'white',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ marginBottom: '16px', color: '#333' }}>📋 日志级别详情</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #e8e8e8' }}>
              <th style={{ padding: '12px', textAlign: 'left' }}>级别</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>数量</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>占比</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>状态</th>
            </tr>
          </thead>
          <tbody>
            {statistics.byLevel.map((item, index) => {
              const percentage = totalLogs > 0 ? ((item.count / totalLogs) * 100).toFixed(2) : 0;
              const colors = {
                FATAL: '#f5222d',
                CRITICAL: '#ff4d4f',
                ERROR: '#fa8c16',
                WARN: '#faad14',
                INFO: '#1890ff',
                DEBUG: '#52c41a',
                TRACE: '#722ed1'
              };
              return (
                <tr key={index} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '4px',
                      background: colors[item.level] || '#d9d9d9',
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: 500
                    }}>
                      {item.level}
                    </span>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 500 }}>
                    {item.count.toLocaleString()}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', color: '#666' }}>
                    {percentage}%
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <div style={{
                      width: '100%',
                      height: '8px',
                      background: '#f0f0f0',
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${percentage}%`,
                        height: '100%',
                        background: colors[item.level] || '#d9d9d9',
                        borderRadius: '4px'
                      }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Statistics;
