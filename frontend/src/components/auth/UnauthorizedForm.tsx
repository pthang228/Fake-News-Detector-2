import React from 'react';
import type { User } from 'firebase/auth';
import '../../styles/components/UnauthorizedForm.css';

interface UnauthorizedFormProps {
  user: User | null;
  onGoBack: () => void;
  onLogout: () => void;
  onLogin: () => void;
}

const UnauthorizedForm: React.FC<UnauthorizedFormProps> = ({
  user,
  onGoBack,
  onLogout,
  onLogin
}) => {
  return (
    <div className="unauthorized-form-container">
      <div className="unauthorized-form">
        {/* Header Section */}
        <div className="unauthorized-header">
          <span className="unauthorized-icon">🚫</span>
          <h1 className="unauthorized-title">
            Không có quyền truy cập
          </h1>
          <p className="unauthorized-subtitle">
            Bạn không có quyền truy cập vào trang này.
          </p>
        </div>

        {/* Info Section */}
        <div className="unauthorized-info">
          <div className="info-item">
            <span className="info-label">Tài khoản hiện tại:</span>
            <span className="info-value">{user?.email || 'Chưa đăng nhập'}</span>
          </div>
          
          <div className="info-item">
            <span className="info-label">Tên hiển thị:</span>
            <span className="info-value">{user?.displayName || 'Chưa cập nhật'}</span>
          </div>
          
          <div className="info-item">
            <span className="info-label">Trạng thái:</span>
            <span className="info-value">{user ? 'Đã đăng nhập' : 'Chưa đăng nhập'}</span>
          </div>

          <div className="info-requirement">
            <strong>Lưu ý:</strong> Trang này yêu cầu quyền truy cập đặc biệt hoặc bạn cần đăng nhập để tiếp tục.
          </div>
        </div>

        {/* Actions Section */}
        <div className="unauthorized-actions">
          <button
            onClick={onGoBack}
            className="unauthorized-btn btn-primary"
            type="button"
          >
            Quay lại trang chính
          </button>
          
          {user && (
            <button
              onClick={onLogout}
              className="unauthorized-btn btn-secondary"
              type="button"
            >
              Đăng xuất
            </button>
          )}
          
          {!user && (
            <button
              onClick={onLogin}
              className="unauthorized-btn btn-secondary"
              type="button"
            >
              Đăng nhập
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedForm;