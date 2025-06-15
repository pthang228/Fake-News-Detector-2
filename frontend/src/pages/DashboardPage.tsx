import React, { useState, useEffect } from 'react';
import { useAuth } from "../hooks/useAuth";
import { firestoreService, type AnalysisEntry } from '../services/firebase/firestoreService';
import '../styles/components/DashboardPage.css';

// Firebase imports for admin functions
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  where,
  writeBatch,
  limit
} from "firebase/firestore";
import { db } from '../services/firebase/firebaseConfig';

// Types
interface UserData {
  uid: string;
  email: string;
  displayName: string;
  createdAt: string;
  lastLoginAt: string;
  analysisCount: number;
  role: string;
}

interface DashboardStats {
  totalUsers: number;
  totalAnalyses: number;
  fakeNewsDetected: number;
  realNewsDetected: number;
  todayAnalyses: number;
  activeUsers: number;
}

const DashboardPage: React.FC = () => {
  const auth = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'users'>('overview');
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Data states
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalAnalyses: 0,
    fakeNewsDetected: 0,
    realNewsDetected: 0,
    todayAnalyses: 0,
    activeUsers: 0
  });
  
  const [allHistory, setAllHistory] = useState<AnalysisEntry[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  
  // Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  // Check if user is admin
  const isAdmin = auth?.role === 'admin';

  // Utility function to safely get email
  const getSafeEmail = (email: any, fallback: string) => {
    if (!email || typeof email !== 'string') {
      return `user-${fallback.substring(0, 8)}@unknown.com`;
    }
    return email;
  };

  // Utility function to safely get display name
  const getSafeDisplayName = (email: string, uid: string) => {
    try {
      if (email && email.includes('@')) {
        return email.split('@')[0];
      }
      return `User-${uid.substring(0, 8)}`;
    } catch {
      return `User-${uid.substring(0, 8)}`;
    }
  };

  // Fetch dashboard statistics
  const fetchDashboardStats = async () => {
    if (!isAdmin) return;

    setLoading(true);
    setError(null);

    try {
      console.log('📊 Fetching dashboard stats...');

      const analysesQuery = query(
        collection(db, 'analysisHistory'),
        orderBy('createdAt', 'desc'),
        limit(1000)
      );
      
      const analysesSnapshot = await getDocs(analysesQuery);
      const allAnalyses: AnalysisEntry[] = [];
      
      analysesSnapshot.forEach((doc) => {
        const data = doc.data();
        const safeEmail = getSafeEmail(data.userEmail, data.userId || doc.id);
        
        allAnalyses.push({
          id: doc.id,
          text: data.text || '[No content]',
          result: data.result || { isFakeNews: false, confidence: 0, reason: 'No result' },
          sourcesAnalyzed: data.sourcesAnalyzed || 0,
          analysisType: data.analysisType || 'unknown',
          timestamp: data.createdAt?.toDate().toISOString() || new Date().toISOString(),
          originalUrl: data.originalUrl,
          twoStepProcess: data.twoStepProcess || false,
          userId: data.userId || 'unknown',
          userEmail: safeEmail
        });
      });

      // Calculate stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const fakeCount = allAnalyses.filter(a => a.result.isFakeNews).length;
      const realCount = allAnalyses.length - fakeCount;
      const todayCount = allAnalyses.filter(a => new Date(a.timestamp) >= today).length;
      
      const uniqueUsers = new Set(allAnalyses.map(a => a.userId)).size;
      const activeUsers = new Set(
        allAnalyses.filter(a => new Date(a.timestamp) >= weekAgo).map(a => a.userId)
      ).size;

      setDashboardStats({
        totalUsers: uniqueUsers,
        totalAnalyses: allAnalyses.length,
        fakeNewsDetected: fakeCount,
        realNewsDetected: realCount,
        todayAnalyses: todayCount,
        activeUsers: activeUsers
      });

      console.log('✅ Dashboard stats loaded');
    } catch (err: any) {
      console.error('❌ Error fetching stats:', err);
      setError(`Lỗi tải thống kê: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all analysis history
  const fetchAllHistory = async () => {
    if (!isAdmin) return;

    setLoading(true);
    setError(null);

    try {
      console.log('📝 Fetching all history...');

      const q = query(
        collection(db, 'analysisHistory'),
        orderBy('createdAt', 'desc'),
        limit(500)
      );

      const querySnapshot = await getDocs(q);
      const history: AnalysisEntry[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const safeEmail = getSafeEmail(data.userEmail, data.userId || doc.id);
        
        history.push({
          id: doc.id,
          text: data.text || '[No content]',
          result: data.result || { isFakeNews: false, confidence: 0, reason: 'No result' },
          sourcesAnalyzed: data.sourcesAnalyzed || 0,
          analysisType: data.analysisType || 'unknown',
          timestamp: data.createdAt?.toDate().toISOString() || new Date().toISOString(),
          originalUrl: data.originalUrl,
          twoStepProcess: data.twoStepProcess || false,
          userId: data.userId || 'unknown',
          userEmail: safeEmail
        });
      });

      setAllHistory(history);
      console.log(`✅ Loaded ${history.length} history records`);
    } catch (err: any) {
      console.error('❌ Error fetching history:', err);
      setError(`Lỗi tải lịch sử: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all users
  const fetchAllUsers = async () => {
    if (!isAdmin) return;

    setLoading(true);
    setError(null);

    try {
      console.log('👥 Fetching all users...');

      const analysesQuery = query(
        collection(db, 'analysisHistory'),
        orderBy('createdAt', 'desc'),
        limit(1000)
      );
      
      const analysesSnapshot = await getDocs(analysesQuery);
      const userStatsMap = new Map<string, {
        email: string;
        count: number;
        lastActivity: string;
        firstActivity: string;
      }>();

      analysesSnapshot.forEach((doc) => {
        const data = doc.data();
        const userId = data.userId || doc.id;
        const safeEmail = getSafeEmail(data.userEmail, userId);
        const timestamp = data.createdAt?.toDate().toISOString() || new Date().toISOString();

        if (userStatsMap.has(userId)) {
          const existing = userStatsMap.get(userId)!;
          userStatsMap.set(userId, {
            ...existing,
            count: existing.count + 1,
            lastActivity: timestamp > existing.lastActivity ? timestamp : existing.lastActivity,
            firstActivity: timestamp < existing.firstActivity ? timestamp : existing.firstActivity
          });
        } else {
          userStatsMap.set(userId, {
            email: safeEmail,
            count: 1,
            lastActivity: timestamp,
            firstActivity: timestamp
          });
        }
      });

      // Convert to UserData array
      const usersData: UserData[] = Array.from(userStatsMap.entries()).map(([uid, stats]) => ({
        uid,
        email: stats.email,
        displayName: getSafeDisplayName(stats.email, uid),
        createdAt: stats.firstActivity,
        lastLoginAt: stats.lastActivity,
        analysisCount: stats.count,
        role: 'user'
      }));

      // Sort by analysis count
      usersData.sort((a, b) => b.analysisCount - a.analysisCount);

      setUsers(usersData);
      console.log(`✅ Loaded ${usersData.length} users`);
    } catch (err: any) {
      console.error('❌ Error fetching users:', err);
      setError(`Lỗi tải users: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Delete user and all their data
  const deleteUserAndData = async (userId: string, userEmail: string) => {
    if (!isAdmin) return;

    const confirmDelete = window.confirm(
      `Bạn có chắc chắn muốn xóa user ${userEmail} và toàn bộ dữ liệu?\n\nHành động này không thể hoàn tác!`
    );

    if (!confirmDelete) return;

    try {
      setLoading(true);
      console.log(`🗑️ Deleting user ${userId}...`);

      // Delete all user's analyses
      const userAnalysesQuery = query(
        collection(db, 'analysisHistory'),
        where('userId', '==', userId)
      );

      const userAnalysesSnapshot = await getDocs(userAnalysesQuery);
      const batch = writeBatch(db);

      userAnalysesSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      // Update local state
      setUsers(prev => prev.filter(user => user.uid !== userId));
      setAllHistory(prev => prev.filter(analysis => analysis.userId !== userId));

      // Update stats
      await fetchDashboardStats();

      alert(`✅ Đã xóa user ${userEmail} và ${userAnalysesSnapshot.size} bản ghi`);
      console.log('✅ User deleted successfully');
    } catch (err: any) {
      console.error('❌ Error deleting user:', err);
      alert(`Lỗi xóa user: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Filter data based on search and filter
  const filteredHistory = allHistory.filter(item => {
    const matchesSearch = searchTerm === '' || 
      item.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.result.reason && item.result.reason.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesFilter = filterType === 'all' ||
      (filterType === 'fake' && item.result.isFakeNews) ||
      (filterType === 'real' && !item.result.isFakeNews) ||
      (filterType === 'url' && item.originalUrl) ||
      (filterType === 'text' && !item.originalUrl);

    return matchesSearch && matchesFilter;
  });

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Load data when component mounts or tab changes
  useEffect(() => {
    if (isAdmin) {
      if (activeTab === 'overview') {
        fetchDashboardStats();
      } else if (activeTab === 'history') {
        fetchAllHistory();
      } else if (activeTab === 'users') {
        fetchAllUsers();
      }
    }
  }, [activeTab, isAdmin]);

  // Helper functions
  const formatDate = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return timestamp;
    }
  };

  const truncateText = (text: string, maxLength: number) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  // If not admin, show access denied
  if (!isAdmin) {
    return (
      <div className="admin-dashboard-wrapper">
        <div className="admin-dashboard-header">
          <h1 className="admin-dashboard-title">Welcome {auth?.user?.displayName || auth?.user?.email}</h1>
          <p className="admin-dashboard-subtitle">Bạn là user bình thường. Chỉ admin mới có thể truy cập dashboard này.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-wrapper">
      <div className="admin-dashboard-header">
        <h1 className="admin-dashboard-title">Admin Dashboard</h1>
        <p className="admin-dashboard-subtitle">Quản trị hệ thống Fake News Detector</p>
      </div>

      {/* Tab Navigation */}
      <div className="admin-dashboard-tabs">
        <button 
          className={`admin-tab-button ${activeTab === 'overview' ? 'admin-tab-active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Tổng quan
        </button>
        <button 
          className={`admin-tab-button ${activeTab === 'history' ? 'admin-tab-active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📝 Lịch sử toàn bộ
        </button>
        <button 
          className={`admin-tab-button ${activeTab === 'users' ? 'admin-tab-active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          👥 Quản lý Users
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="admin-error-msg">
          ❌ {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Loading Display */}
      {loading && (
        <div className="admin-loading-msg">
          <span className="admin-loading-spinner"></span>
          🔄 Đang tải dữ liệu...
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="admin-dashboard-content">
          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <div className="admin-stat-icon">👥</div>
              <div className="admin-stat-info">
                <h3>{dashboardStats.totalUsers}</h3>
                <p>Tổng số Users</p>
              </div>
            </div>
            
            <div className="admin-stat-card">
              <div className="admin-stat-icon">📊</div>
              <div className="admin-stat-info">
                <h3>{dashboardStats.totalAnalyses}</h3>
                <p>Tổng phân tích</p>
              </div>
            </div>
            
            <div className="admin-stat-card">
              <div className="admin-stat-icon">❌</div>
              <div className="admin-stat-info">
                <h3>{dashboardStats.fakeNewsDetected}</h3>
                <p>Fake News</p>
              </div>
            </div>
            
            <div className="admin-stat-card">
              <div className="admin-stat-icon">✅</div>
              <div className="admin-stat-info">
                <h3>{dashboardStats.realNewsDetected}</h3>
                <p>Real News</p>
              </div>
            </div>
            
            <div className="admin-stat-card">
              <div className="admin-stat-icon">📅</div>
              <div className="admin-stat-info">
                <h3>{dashboardStats.todayAnalyses}</h3>
                <p>Hôm nay</p>
              </div>
            </div>
            
            <div className="admin-stat-card">
              <div className="admin-stat-icon">🔥</div>
              <div className="admin-stat-info">
                <h3>{dashboardStats.activeUsers}</h3>
                <p>Users hoạt động</p>
              </div>
            </div>
          </div>

          <div className="admin-dashboard-actions">
            <button 
              onClick={fetchDashboardStats}
              className="admin-refresh-btn"
              disabled={loading}
            >
              🔄 Làm mới thống kê
            </button>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="admin-dashboard-content">
          <div className="admin-content-header">
            <h2 className="admin-content-title">📝 Lịch sử phân tích toàn bộ</h2>
            
            <div className="admin-search-container">
              <input
                type="text"
                placeholder="Tìm kiếm theo nội dung, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="admin-search-input"
              />
              
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="admin-filter-select"
              >
                <option value="all">Tất cả</option>
                <option value="fake">Fake News</option>
                <option value="real">Real News</option>
                <option value="url">Phân tích URL</option>
                <option value="text">Phân tích Text</option>
              </select>
            </div>
          </div>

          <div className="admin-history-list">
            <div className="admin-history-stats">
              Hiển thị {filteredHistory.length} / {allHistory.length} bản ghi
            </div>
            
            {filteredHistory.map((item) => (
              <div key={item.id} className="admin-history-item">
                <div className="admin-history-header">
                  <div className="admin-history-meta">
                    <span className="admin-user-badge">👤 {item.userEmail}</span>
                    <span className="admin-timestamp-badge">🕒 {formatDate(item.timestamp)}</span>
                    <span className={`admin-type-badge ${item.originalUrl ? 'admin-type-url' : 'admin-type-text'}`}>
                      {item.originalUrl ? '🔗 URL' : '📝 Text'}
                    </span>
                  </div>
                  <div className={`admin-result-badge ${item.result.isFakeNews ? 'admin-result-fake' : 'admin-result-real'}`}>
                    {item.result.isFakeNews ? '❌ FAKE' : '✅ REAL'} 
                    ({item.result.confidence}%)
                  </div>
                </div>
                
                <div className="admin-history-content">
                  <div className="admin-analyzed-text">
                    <strong>Nội dung:</strong> {truncateText(item.text, 200)}
                  </div>
                  
                  {item.originalUrl && (
                    <div className="admin-original-url">
                      <strong>URL:</strong> 
                      <a href={item.originalUrl} target="_blank" rel="noopener noreferrer">
                        {truncateText(item.originalUrl, 100)}
                      </a>
                    </div>
                  )}
                  
                  <div className="admin-analysis-reason">
                    <strong>Lý do:</strong> {truncateText(item.result.reason, 300)}
                  </div>
                </div>
              </div>
            ))}
            
            {filteredHistory.length === 0 && !loading && (
              <div className="admin-no-data">
                📭 Không có dữ liệu
              </div>
            )}
          </div>
        </div>
      )}

      {/* Users Management Tab */}
      {activeTab === 'users' && (
        <div className="admin-dashboard-content">
          <div className="admin-content-header">
            <h2 className="admin-content-title">👥 Quản lý Users</h2>
            
            <div className="admin-search-container">
              <input
                type="text"
                placeholder="Tìm kiếm theo email hoặc tên..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="admin-search-input"
              />
            </div>
          </div>

          <div className="admin-users-list">
            <div className="admin-users-stats">
              Hiển thị {filteredUsers.length} / {users.length} users
            </div>
            
            <div className="admin-users-grid">
              {filteredUsers.map((user) => (
                <div key={user.uid} className="admin-user-card">
                  <div className="admin-user-info">
                    <div className="admin-user-avatar">
                      {user.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="admin-user-details">
                      <h3 className="admin-user-name">{user.displayName}</h3>
                      <p className="admin-user-email">{user.email}</p>
                      <div className="admin-user-stats">
                        <span className="admin-user-stat">📊 {user.analysisCount} phân tích</span>
                        <span className="admin-user-stat">🕒 {formatDate(user.lastLoginAt)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="admin-user-actions">
                    <button
                      onClick={() => deleteUserAndData(user.uid, user.email)}
                      className="admin-delete-user-btn"
                      disabled={loading}
                    >
                      🗑️ Xóa User
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            {filteredUsers.length === 0 && !loading && (
              <div className="admin-no-data">
                📭 Không tìm thấy user nào
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;