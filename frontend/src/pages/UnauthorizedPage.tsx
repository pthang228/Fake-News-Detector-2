import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import UnauthorizedForm from '../components/auth/UnauthorizedForm';

const UnauthorizedPage = () => {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();

  // Handler functions
  const handleGoBack = () => {
    // Redirect dựa theo user status
    if (auth?.user) {
      navigate('/dashboard'); // User về trang dashboard
    } else {
      navigate('/login'); // Nếu chưa đăng nhập thì về login
    }
  };

  const handleLogout = () => {
    auth?.logout();
    navigate('/login');
  };

  const handleLogin = () => {
    navigate('/login');
  };

  return (
    <UnauthorizedForm
      user={auth?.user || null}
      onGoBack={handleGoBack}
      onLogout={handleLogout}
      onLogin={handleLogin}
    />
  );
};

export default UnauthorizedPage;