import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface PublicRouteProps {
  children: React.ReactNode;
}

const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const auth = useAuth();

  if (auth.loading) return <div>Loading...</div>;
  console.log('PublicRoute auth:', auth.user);
  if (auth.user) {
    // Nếu đã đăng nhập thì redirect về dashboard
    return <Navigate to="/about" replace />;
  }

  return <>{children}</>;
};

export default PublicRoute;
