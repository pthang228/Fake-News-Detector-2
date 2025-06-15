import React from 'react';
import { useAuth } from '../../hooks/useAuth';

interface ProtectedAdminRouteProps {
  children: React.ReactNode;
}

const ProtectedAdminRoute: React.FC<ProtectedAdminRouteProps> = ({ children }) => {
  const { user, role, loading } = useAuth();

  // Hiển thị loading khi đang check auth
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '4px solid rgba(255,255,255,0.3)',
            borderTop: '4px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }}></div>
          <h2>Đang kiểm tra quyền truy cập...</h2>
        </div>
      </div>
    );
  }

  // Kiểm tra quyền admin
  if (!user || role !== 'admin') {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        textAlign: 'center'
      }}>
        <div>
          <h1>⛔ Truy cập bị từ chối</h1>
          <p style={{ fontSize: '1.2rem', margin: '1rem 0' }}>
            Bạn không có quyền admin để truy cập trang này
          </p>
          <button 
            onClick={() => window.history.back()}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: '2px solid white',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '600'
            }}
          >
            ← Quay lại
          </button>
        </div>
      </div>
    );
  }

  // Cho phép truy cập nếu là admin
  return <>{children}</>;
};

export default ProtectedAdminRoute;