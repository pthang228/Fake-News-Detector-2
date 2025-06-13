import React, { useState, useEffect } from 'react';
import '../styles/components/HistoryPage.css';
import { useAuth } from '../hooks/useAuth';
import { firestoreService, type AnalysisEntry } from '../services/firebase/firestoreService';

const HistoryPage: React.FC = () => {
  // State management
  const [history, setHistory] = useState<AnalysisEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [statistics, setStatistics] = useState<any>(null);
  
  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  // Auth
  const { user } = useAuth();

  // Fetch history từ Firebase với error handling tốt hơn
  const fetchHistory = async () => {
    if (!user) {
      setError('Bạn cần đăng nhập để xem lịch sử');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Đang tải lịch sử cho user:', user.uid);
      
      // Kiểm tra kết nối Firebase trước
      try {
        // Test với một query đơn giản
        const testHistory = await firestoreService.getUserHistory(user.uid, 1);
        console.log('✅ Firebase connection test successful');
      } catch (connectionError) {
        console.error('❌ Firebase connection failed:', connectionError);
        throw new Error('Không thể kết nối đến Firebase. Vui lòng kiểm tra cấu hình.');
      }
      
      // Lấy lịch sử và thống kê
      const [historyData, statsData] = await Promise.all([
        firestoreService.getUserHistory(user.uid, 100),
        firestoreService.getUserStatistics(user.uid)
      ]);
      
      console.log('📊 Đã tải:', historyData.length, 'bản ghi lịch sử');
      
      setHistory(historyData);
      setStatistics(statsData);
    } catch (err: any) {
      console.error('❌ Error fetching history:', err);
      
      // Xử lý các loại lỗi khác nhau
      if (err.code === 'permission-denied') {
        setError('Không có quyền truy cập dữ liệu. Vui lòng kiểm tra quy tắc Firestore.');
      } else if (err.code === 'unavailable') {
        setError('Dịch vụ Firebase tạm thời không khả dụng. Vui lòng thử lại sau.');
      } else if (err.message?.includes('Firebase')) {
        setError(err.message);
      } else {
        setError('Lỗi kết nối đến Firebase: ' + (err.message || 'Lỗi không xác định'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Load history khi component mount hoặc user thay đổi
  useEffect(() => {
    if (user) {
      console.log('👤 User changed, fetching history for:', user.email);
      fetchHistory();
    } else {
      console.log('❌ No user found');
      setHistory([]);
      setStatistics(null);
      setLoading(false);
    }
  }, [user]);

  // Search history với filter và debounce
  const searchHistory = async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log('🔍 Searching with:', { searchTerm, filterType, sortBy });
      
      const results = await firestoreService.searchUserHistory(
        user.uid,
        searchTerm,
        filterType,
        sortBy,
        100
      );
      
      console.log('📋 Search results:', results.length, 'items');
      setHistory(results);
    } catch (err: any) {
      console.error('❌ Error searching history:', err);
      setError('Lỗi khi tìm kiếm: ' + (err.message || 'Lỗi không xác định'));
    } finally {
      setLoading(false);
    }
  };

  // Trigger search khi filter thay đổi với debounce
  useEffect(() => {
    if (user) {
      const timeoutId = setTimeout(() => {
        if (searchTerm || filterType !== 'all' || sortBy !== 'newest') {
          searchHistory();
        } else {
          // Nếu reset về default, load lại toàn bộ
          fetchHistory();
        }
      }, 300); // Debounce 300ms

      return () => clearTimeout(timeoutId);
    }
  }, [searchTerm, filterType, sortBy, user]);

  // Clear history
  const clearHistory = async () => {
    if (!user) return;
    
    if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử?')) {
      try {
        setLoading(true);
        console.log('🗑️ Clearing all history for user:', user.uid);
        
        const deletedCount = await firestoreService.clearUserHistory(user.uid);
        
        setHistory([]);
        setStatistics({ 
          total: 0, 
          fakeCount: 0, 
          realCount: 0, 
          urlAnalyses: 0,
          textAnalyses: 0,
          twoStepAnalyses: 0,
          avgConfidence: 0,
          todayCount: 0,
          weekCount: 0,
          monthCount: 0
        });
        
        alert(`✅ Đã xóa ${deletedCount} bản ghi lịch sử`);
        console.log('✅ History cleared successfully');
      } catch (err: any) {
        console.error('❌ Error clearing history:', err);
        alert('Lỗi khi xóa lịch sử: ' + (err.message || 'Lỗi không xác định'));
      } finally {
        setLoading(false);
      }
    }
  };

  // Delete single item
  const deleteItem = async (itemId: string) => {
    if (!user) return;

    if (window.confirm('Bạn có chắc chắn muốn xóa mục này?')) {
      try {
        console.log('🗑️ Deleting item:', itemId);
        
        await firestoreService.deleteAnalysis(user.uid, itemId);
        
        // Update local state
        const deletedItem = history.find(item => item.id === itemId);
        setHistory(prev => prev.filter(item => item.id !== itemId));
        
        // Update statistics
        if (statistics && deletedItem) {
          setStatistics({
            ...statistics,
            total: statistics.total - 1,
            fakeCount: deletedItem.result.isFakeNews ? statistics.fakeCount - 1 : statistics.fakeCount,
            realCount: !deletedItem.result.isFakeNews ? statistics.realCount - 1 : statistics.realCount,
            urlAnalyses: deletedItem.originalUrl ? statistics.urlAnalyses - 1 : statistics.urlAnalyses,
            textAnalyses: !deletedItem.originalUrl ? statistics.textAnalyses - 1 : statistics.textAnalyses
          });
        }
        
        console.log('✅ Item deleted successfully');
      } catch (err: any) {
        console.error('❌ Error deleting item:', err);
        alert('Lỗi khi xóa mục: ' + (err.message || 'Lỗi không xác định'));
      }
    }
  };

  // Toggle expand item
  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  // Format date
  const formatDate = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (err) {
      return timestamp;
    }
  };

  // Truncate text
  const truncateText = (text: string, maxLength: number) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  // Nếu chưa đăng nhập
  if (!user) {
    return (
      <div className="history-page">
        <div className="container">
          <div className="error-container">
            <h2>Cần đăng nhập</h2>
            <p>Bạn cần đăng nhập để xem lịch sử phân tích</p>
            <button className="btn-retry" onClick={() => window.location.href = '/login'}>
              Đăng nhập
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render loading state
  if (loading) {
    return (
      <div className="history-page">
        <div className="container">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <h2>Đang tải lịch sử...</h2>
            <p>Kết nối đến Firebase và tải dữ liệu...</p>
          </div>
        </div>
      </div>
    );
  }

  // Render error state với thông tin debug
  if (error) {
    return (
      <div className="history-page">
        <div className="container">
          <div className="error-container">
            <h2>Có lỗi xảy ra</h2>
            <p>{error}</p>
            <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', fontSize: '0.9rem' }}>
              <p><strong>Debug Info:</strong></p>
              <p>User: {user?.email || 'No user'}</p>
              <p>User ID: {user?.uid || 'No UID'}</p>
              <p>Firebase Config: {process.env.NODE_ENV === 'development' ? 'Check console for details' : 'Production mode'}</p>
            </div>
            <button className="btn-retry" onClick={fetchHistory}>
              Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="history-page">
      <div className="container">
        {/* Header */}
        <div className="history-header">
          <h1>Lịch Sử Phân Tích</h1>
          <p className="subtitle">
            Xem lại các kết quả phân tích fake news đã thực hiện ({user.email})
          </p>
        </div>

        {/* Controls */}
        <div className="history-controls">
          {/* Search Section */}
          <div className="search-section">
            <div className="search-box">
              <input
                type="text"
                className="search-input"
                placeholder="Tìm kiếm trong lịch sử..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="search-icon">🔍</span>
            </div>
          </div>

          {/* Filter Section */}
          <div className="filter-section">
            <select
              className="filter-select"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">Tất cả</option>
              <option value="fake">Tin giả</option>
              <option value="real">Tin thật</option>
              <option value="url">Phân tích URL</option>
              <option value="text">Phân tích văn bản</option>
              <option value="two-step">Two-Step Process</option>
            </select>

            <select
              className="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
              <option value="confidence">Độ tin cậy cao</option>
            </select>
          </div>

          {/* Action Section */}
          <div className="action-section">
            <button className="btn-refresh" onClick={fetchHistory}>
              🔄 Làm mới
            </button>
            <button className="btn-clear" onClick={clearHistory}>
              🗑️ Xóa tất cả
            </button>
          </div>
        </div>

        {/* Statistics */}
        {statistics && (
          <div className="history-stats">
            <div className="stat-card">
              <span className="stat-number">{statistics.total}</span>
              <span className="stat-label">Tổng phân tích</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">{statistics.fakeCount}</span>
              <span className="stat-label">Tin giả</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">{statistics.realCount}</span>
              <span className="stat-label">Tin thật</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">{statistics.urlAnalyses}</span>
              <span className="stat-label">Phân tích URL</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">{statistics.avgConfidence}%</span>
              <span className="stat-label">Độ tin cậy TB</span>
            </div>
          </div>
        )}

        {/* History List */}
        <div className="history-list">
          {history.length === 0 ? (
            <div className="empty-state">
              <h3>Không có kết quả</h3>
              <p>
                {searchTerm || filterType !== 'all' 
                  ? 'Không tìm thấy kết quả phù hợp với bộ lọc của bạn'
                  : 'Chưa có lịch sử phân tích nào. Hãy thử phân tích một số nội dung!'
                }
              </p>
              {!searchTerm && filterType === 'all' && (
                <button 
                  className="btn-retry" 
                  onClick={() => window.location.href = '/analysis'}
                  style={{ marginTop: '1rem' }}
                >
                  Đi tới trang phân tích
                </button>
              )}
            </div>
          ) : (
            history.map((item) => (
              <div key={item.id} className="history-item">
                {/* Item Header */}
                <div 
                  className="item-header"
                  onClick={() => toggleExpand(item.id)}
                >
                  <div className="item-main-info">
                    <div className="item-type-badge">
                      {item.analysisType}
                    </div>
                    <div className="item-content">
                      <h3 className="item-title">
                        {item.originalUrl 
                          ? truncateText(item.originalUrl, 80)
                          : truncateText(item.text, 100)
                        }
                      </h3>
                      <p className="item-preview">
                        {truncateText(item.result.reason, 150)}
                      </p>
                    </div>
                  </div>

                  <div className="item-meta">
                    <div className="result-badge">
                      <span className={`badge ${item.result.isFakeNews ? 'badge-fake' : 'badge-real'}`}>
                        {item.result.isFakeNews ? 'Tin giả' : 'Tin thật'}
                      </span>
                      <span className="confidence-score">
                        {item.result.confidence}%
                      </span>
                    </div>
                    
                    <div className="item-stats">
                      <span className="stat-item">
                        📅 {formatDate(item.timestamp)}
                      </span>
                      {item.sourcesAnalyzed > 0 && (
                        <span className="stat-item">
                          📊 {item.sourcesAnalyzed} nguồn
                        </span>
                      )}
                      {item.twoStepProcess && (
                        <span className="stat-item">
                          🔄 2-Step
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button 
                        className="expand-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteItem(item.id);
                        }}
                        style={{ color: '#ef4444' }}
                        title="Xóa mục này"
                      >
                        🗑️
                      </button>
                      <button className="expand-btn">
                        {expandedItems.has(item.id) ? '▲' : '▼'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Item Details */}
                {expandedItems.has(item.id) && (
                  <div className="item-details">
                    {/* Original Text if not URL */}
                    {!item.originalUrl && (
                      <div className="detail-section">
                        <h4>📄 Nội dung gốc</h4>
                        <p className="analysis-reason" style={{ fontStyle: 'italic', background: 'rgba(15, 23, 42, 0.5)', padding: '1rem', borderRadius: '8px' }}>
                          {item.text}
                        </p>
                      </div>
                    )}

                    {/* Analysis Reason */}
                    <div className="detail-section">
                      <h4>📝 Phân tích chi tiết</h4>
                      <p className="analysis-reason">{item.result.reason}</p>
                    </div>

                    {/* Indicators */}
                    {item.result.indicators && item.result.indicators.length > 0 && (
                      <div className="detail-section">
                        <h4>⚠️ Các dấu hiệu nhận biết</h4>
                        <ul className="indicators-list">
                          {item.result.indicators.map((indicator, index) => (
                            <li key={index}>{indicator}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Recommendation */}
                    <div className="detail-section">
                      <h4>💡 Khuyến nghị</h4>
                      <p className="recommendation">{item.result.recommendation}</p>
                    </div>

                    {/* Key Topics (for URL analysis) */}
                    {item.result.keyTopics && item.result.keyTopics.length > 0 && (
                      <div className="detail-section">
                        <h4>🎯 Chủ đề chính</h4>
                        <div className="topics-tags">
                          {item.result.keyTopics.map((topic, index) => (
                            <span key={index} className="topic-tag">{topic}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Original URL */}
                    {item.originalUrl && (
                      <div className="detail-section">
                        <h4>🔗 URL gốc</h4>
                        <a 
                          href={item.originalUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="original-url"
                        >
                          {item.originalUrl}
                        </a>
                      </div>
                    )}

                    {/* Analysis Metadata */}
                    <div className="detail-section">
                      <h4>📊 Thông tin phân tích</h4>
                      <div className="analysis-metadata">
                        <div className="metadata-item">
                          <span className="metadata-label">Thời gian:</span>
                          <span className="metadata-value">{formatDate(item.timestamp)}</span>
                        </div>
                        <div className="metadata-item">
                          <span className="metadata-label">Độ tin cậy:</span>
                          <span className="metadata-value">{item.result.confidence}%</span>
                        </div>
                        <div className="metadata-item">
                          <span className="metadata-label">Nguồn phân tích:</span>
                          <span className="metadata-value">{item.sourcesAnalyzed || 0} nguồn</span>
                        </div>
                        <div className="metadata-item">
                          <span className="metadata-label">Loại phân tích:</span>
                          <span className="metadata-value">{item.analysisType}</span>
                        </div>
                        {item.result.webEvidenceUsed && (
                          <div className="metadata-item">
                            <span className="metadata-label">Web Evidence:</span>
                            <span className="metadata-value">✅ Có sử dụng</span>
                          </div>
                        )}
                        {item.twoStepProcess && (
                          <div className="metadata-item">
                            <span className="metadata-label">Two-Step Process:</span>
                            <span className="metadata-value">✅ Enabled</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="history-footer">
          <p>
            Hiển thị {history.length} kết quả từ Firebase Firestore
            {statistics && ` • Tổng cộng ${statistics.total} bản ghi`}
          </p>
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;