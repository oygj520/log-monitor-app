import React, { useState, useEffect } from 'react';
import { Modal, Input, message } from 'antd';
const { confirm: modalConfirm } = Modal;

function ArchiveManager() {
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState(null);
  const [selectedArchive, setSelectedArchive] = useState(null);
  const [archiveLogs, setArchiveLogs] = useState([]);
  const [viewingLogs, setViewingLogs] = useState(false);
  const [queryOptions, setQueryOptions] = useState({
    level: '',
    keyword: '',
    page: 1,
    pageSize: 50
  });

  useEffect(() => {
    loadArchives();
    loadStatistics();
  }, []);

  const loadArchives = async () => {
    setLoading(true);
    try {
      if (window.electronAPI) {
        const data = await window.electronAPI.getArchiveList();
        setArchives(data || []);
      }
    } catch (error) {
      console.error('加载归档列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      if (window.electronAPI) {
        const stats = await window.electronAPI.getArchiveStatistics();
        setStatistics(stats);
      }
    } catch (error) {
      console.error('加载归档统计失败:', error);
    }
  };

  const handleTriggerArchive = async () => {
    // 使用 antd Modal 替代 prompt
    Modal.confirm({
      title: '归档日志',
      content: (
        <div>
          <p>确定要归档 7 天前的日志吗？</p>
          <p style={{color: '#999', fontSize: '12px'}}>此操作将压缩并清理旧日志</p>
        </div>
      ),
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        const daysToKeep = 7;
        try {
          if (window.electronAPI) {
            const result = await window.electronAPI.triggerArchive(daysToKeep);
            if (result && result.success) {
              message.success(`归档完成！归档日志数：${result.archived || 0}`);
              loadArchives();
              loadStatistics();
            } else {
              message.error('归档失败：' + (result?.error || '未知错误'));
            }
          }
        } catch (error) {
          console.error('触发归档失败:', error);
          message.error('归档失败：' + error.message);
        }
      }
    });
  };

  const handleViewLogs = async (archive) => {
    setSelectedArchive(archive);
    setViewingLogs(true);
    await loadArchiveLogs(archive.id);
  };

  const loadArchiveLogs = async (archiveId) => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.queryArchiveLogs(archiveId, queryOptions);
        if (result.success) {
          setArchiveLogs(result.logs || []);
        } else {
          alert('查询失败：' + result.error);
        }
      }
    } catch (error) {
      console.error('查询归档日志失败:', error);
    }
  };

  const handleDeleteArchive = async (archiveId) => {
    if (!confirm('确定要删除这个归档吗？此操作不可恢复！')) return;

    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.deleteArchive(archiveId);
        if (result.success) {
          alert('归档已删除');
          loadArchives();
          loadStatistics();
        } else {
          alert('删除失败：' + result.error);
        }
      }
    } catch (error) {
      console.error('删除归档失败:', error);
      alert('删除失败：' + error.message);
    }
  };

  const handleCloseLogView = () => {
    setViewingLogs(false);
    setSelectedArchive(null);
    setArchiveLogs([]);
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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

  return (
    <div>
      {/* 统计卡片 */}
      {statistics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div className="card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{statistics.totalArchives || 0}</div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>归档文件数</div>
          </div>
          <div className="card" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{statistics.totalLogs || 0}</div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>归档日志数</div>
          </div>
          <div className="card" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{formatSize(statistics.totalCompressedSize)}</div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>压缩后大小</div>
          </div>
          <div className="card" style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', color: 'white' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{statistics.compressionRatio || '0%'}</div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>压缩比</div>
          </div>
        </div>
      )}

      {/* 归档列表 */}
      <div className="card">
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>归档管理</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary" onClick={handleTriggerArchive}>
              🗄️ 立即归档
            </button>
            <button className="btn btn-primary" onClick={loadArchives}>
              🔄 刷新
            </button>
          </div>
        </div>

        <div style={{ padding: '16px', background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: '6px', marginBottom: '16px' }}>
          <strong>💡 自动归档说明：</strong>
          <ul style={{ margin: '8px 0 0 20px', fontSize: '14px' }}>
            <li>系统每天凌晨 2 点自动归档 7 天前的日志</li>
            <li>归档文件采用 gzip 压缩存储，节省磁盘空间</li>
            <li>归档后的日志仍可通过本界面查询</li>
            <li>可随时手动触发归档操作</li>
          </ul>
        </div>

        {loading ? (
          <div className="empty-state">加载中...</div>
        ) : archives.length > 0 ? (
          <div>
            {archives.map((archive, index) => (
              <div
                key={archive.id || index}
                style={{
                  padding: '16px',
                  border: '1px solid #e8e8e8',
                  borderRadius: '6px',
                  marginBottom: '12px',
                  background: '#fafafa'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
                      📦 {archive.id}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', fontSize: '14px' }}>
                      <div>📅 起始时间：{new Date(archive.startDate).toLocaleString('zh-CN')}</div>
                      <div>📅 结束时间：{new Date(archive.endDate).toLocaleString('zh-CN')}</div>
                      <div>📊 日志数量：{archive.originalCount} 条</div>
                      <div>💾 原始大小：{formatSize(archive.originalSize)}</div>
                      <div>🗜️ 压缩后：{formatSize(archive.compressedSize)}</div>
                      <div>📅 归档时间：{new Date(archive.createdAt).toLocaleString('zh-CN')}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                    <button
                      className="btn"
                      onClick={() => handleViewLogs(archive)}
                    >
                      👁️ 查看
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDeleteArchive(archive.id)}
                    >
                      🗑️ 删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">🗄️</div>
            <div className="empty-state-text">暂无归档文件</div>
            <div className="empty-state-help">日志归档将在每天凌晨 2 点自动执行</div>
          </div>
        )}
      </div>

      {/* 查看归档日志弹窗 */}
      {viewingLogs && selectedArchive && (
        <div className="modal-overlay" onClick={handleCloseLogView}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '1000px' }}>
            <div className="modal-header">
              <div className="modal-title">查看归档日志 - {selectedArchive.id}</div>
              <button className="modal-close" onClick={handleCloseLogView}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <select
                  className="form-input"
                  value={queryOptions.level}
                  onChange={(e) => setQueryOptions(prev => ({ ...prev, level: e.target.value, page: 1 }))}
                >
                  <option value="">全部级别</option>
                  <option value="ERROR">ERROR</option>
                  <option value="FATAL">FATAL</option>
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="WARNING">WARNING</option>
                  <option value="INFO">INFO</option>
                </select>

                <input
                  type="text"
                  className="form-input"
                  placeholder="搜索关键字..."
                  value={queryOptions.keyword}
                  onChange={(e) => setQueryOptions(prev => ({ ...prev, keyword: e.target.value, page: 1 }))}
                  onKeyPress={(e) => e.key === 'Enter' && loadArchiveLogs(selectedArchive.id)}
                />

                <button className="btn btn-primary" onClick={() => loadArchiveLogs(selectedArchive.id)}>
                  搜索
                </button>
              </div>

              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {archiveLogs.length > 0 ? (
                  archiveLogs.map((log, index) => (
                    <div
                      key={log.id || index}
                      style={{
                        padding: '8px',
                        border: '1px solid #e8e8e8',
                        borderRadius: '4px',
                        marginBottom: '8px',
                        background: log.level === 'ERROR' || log.level === 'FATAL' ? '#fff1f0' : '#fafafa'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '3px',
                            fontSize: '11px',
                            background: getLevelColor(log.level),
                            color: 'white'
                          }}
                        >
                          {log.level}
                        </span>
                        <span style={{ fontSize: '12px', color: '#999' }}>
                          {new Date(log.timestamp).toLocaleString('zh-CN')}
                        </span>
                        <span style={{ fontSize: '12px', color: '#666' }}>
                          {log.source}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                        {log.message}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">暂无日志</div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={handleCloseLogView}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ArchiveManager;
