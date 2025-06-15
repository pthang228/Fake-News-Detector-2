import LoginForm from '../components/auth/LoginForm';
import { login as Login } from '../services/firebase/firebaseAuth';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useContext } from 'react';

const LoginPage = () => {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();
  
  const handleLogin = async (email: string, password: string) => {
    try {
      console.log('🔥 Bắt đầu đăng nhập Firebase...');
      
      // 1. Đăng nhập Firebase
      const user = await Login(email, password);
      console.log('✅ Firebase đăng nhập thành công:', user.email);
      
      // 2. Lấy ID token và custom claims
      const idToken = await user?.getIdToken();
      const tokenResult = await user?.getIdTokenResult();
      
      // 3. Lấy role từ custom claims (ưu tiên cao nhất)
      const firebaseRole = tokenResult?.claims?.role as string;
      console.log('🔑 Firebase custom claims role:', firebaseRole);
      
      let finalRole = firebaseRole || 'user'; // Default fallback
      
      try {
        // 4. Thử lấy role từ backend (optional)
        console.log('🌐 Đang gửi request đến backend...');
        const res = await fetch('http://localhost:5000/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ email, password }),
        });
        
        if (res.ok) {
          const data = await res.json();
          console.log('✅ Backend phản hồi thành công:', data);
          
          // Ưu tiên role từ backend nếu có
          finalRole = data.role || firebaseRole || 'user';
        } else {
          console.log('⚠️ Backend lỗi, sử dụng Firebase role:', firebaseRole || 'user');
        }
        
      } catch (backendError: any) {
        console.error('🌐 Backend Error:', backendError);
        console.log('⚠️ Backend không khả dụng, sử dụng Firebase role:', firebaseRole || 'user');
      }
      
      console.log('👤 Final role assigned:', finalRole);
      
      // 5. Đăng nhập với role đã xác định
      auth?.login(user, finalRole);
      
      // 6. Điều hướng dựa trên role
      if (finalRole === 'admin') {
        navigate('/dashboard');
      } else {
        navigate('/about'); // User thường về trang about
      }
      
    } catch (firebaseError: any) {
      // 🐛 DEBUG: In ra chi tiết lỗi
      console.group('🐛 Firebase Error Debug');
      console.log('Error Code:', firebaseError.code);
      console.log('Error Message:', firebaseError.message);
      console.log('Error Name:', firebaseError.name);
      console.log('Full Error Object:', firebaseError);
      console.groupEnd();
      
      // Xử lý các lỗi Firebase cụ thể
      let errorMessage = 'Đăng nhập thất bại. ';
      
      switch (firebaseError.code) {
        // Firebase v9+ error codes
        case 'auth/invalid-credential':
        case 'auth/invalid-login-credentials':
          errorMessage += 'Email hoặc mật khẩu không đúng.';
          break;
        case 'auth/user-not-found':
          errorMessage += 'Tài khoản không tồn tại.';
          break;
        case 'auth/too-many-requests':
          errorMessage += 'Quá nhiều lần thử. Vui lòng thử lại sau.';
          break;
        case 'auth/network-request-failed':
          errorMessage += 'Lỗi kết nối mạng.';
          break;
        default:
          console.warn('⚠️ Unhandled error code:', firebaseError.code);
          errorMessage += `Lỗi: ${firebaseError.message || 'Không xác định'}`;
      }
      
      alert(errorMessage);
    }
  };

  return <LoginForm onLogin={handleLogin} />;
};

export default LoginPage;