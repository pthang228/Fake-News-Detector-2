import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string | string[]; // ✅ Thêm prop kiểm tra role
  redirectTo?: string; // ✅ Trang redirect khi không có quyền
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredRole,
  redirectTo = '/unauthorized' 
}) => {
  const auth = useAuth();

  // Loading state
  if (auth.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Đang kiểm tra quyền truy cập...</div>
      </div>
    );
  }

  console.log('ProtectedRoute - User:', auth.user);
  console.log('ProtectedRoute - Role:', auth.role);
  console.log('ProtectedRoute - Required Role:', requiredRole);

  // Chưa login → redirect login
  if (auth.user === null) {
    return <Navigate to="/login" replace />;
  }

  // ✅ Kiểm tra role nếu có yêu cầu
  if (requiredRole) {
    const userRole = auth.role;
    
    // Nếu không có role
    if (!userRole) {
      console.log('User has no role, redirecting to:', redirectTo);
      return <Navigate to={redirectTo} replace />;
    }

    // Kiểm tra role (hỗ trợ string hoặc array)
    const hasPermission = Array.isArray(requiredRole)
      ? requiredRole.includes(userRole)
      : userRole === requiredRole;

    if (!hasPermission) {
      console.log(`User role '${userRole}' not in required roles:`, requiredRole);
      return <Navigate to={redirectTo} replace />;
    }
  }

  // ✅ Tất cả OK → render children
  return <>{children}</>;
};

export default ProtectedRoute;