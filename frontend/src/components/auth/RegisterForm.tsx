import React, { useState, useEffect } from 'react';
import '../../styles/components/RegisterForm.css';

interface RegisterFormProps {
  onRegister: (email: string, password: string, username: string) => Promise<void>;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onRegister }) => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Validation states
  const [validationState, setValidationState] = useState({
    email: false,
    username: false,
    password: false,
    confirmPassword: false
  });

  // Real-time validation
  useEffect(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    setValidationState({
      email: email.length > 0 && emailRegex.test(email),
      username: username.length >= 3,
      password: password.length >= 6,
      confirmPassword: confirmPassword.length > 0 && password === confirmPassword
    });
  }, [email, username, password, confirmPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError('Email không được để trống');
      return;
    }
    if (!username) {
      setError('Tên người dùng không được để trống');
      return;
    }
    if (!password) {
      setError('Mật khẩu không được để trống');
      return;
    }
    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    // Additional validation
    const emailRegex = /^[^\s@]+@gmail\.com$/;
    if (!emailRegex.test(email)) {
      setError('Email không hợp lệ');
      return;
    }
    if (username.length < 3) {
      setError('Tên người dùng phải có ít nhất 3 ký tự');
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    setLoading(true);
    try {
      await onRegister(email, password, username);
    } catch {
      setError('Đăng ký thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="register-form" onSubmit={handleSubmit}>
      <h2>Đăng ký</h2>
      {error && <p className="error">{error}</p>}
      
      <label>Email:</label>
      <input
        type="text"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Nhập email"
        className={validationState.email ? 'valid' : ''}
      />
      
      <label>Tên người dùng:</label>
      <input
        type="text"
        value={username}
        onChange={e => setUsername(e.target.value)}
        placeholder="Nhập Username (tối thiểu 3 ký tự)"
        className={validationState.username ? 'valid' : ''}
      />
      
      <label>Mật khẩu:</label>
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)"
        className={validationState.password ? 'valid' : ''}
      />
      
      <label>Xác nhận mật khẩu:</label>
      <input
        type="password"
        value={confirmPassword}
        onChange={e => setConfirmPassword(e.target.value)}
        placeholder="Nhập lại mật khẩu"
        className={validationState.confirmPassword ? 'valid' : (confirmPassword.length > 0 ? 'invalid' : '')}
      />
      
      <button type="submit" disabled={loading}>
        {loading ? 'Đang đăng ký...' : 'Đăng ký'}
      </button>
    </form>
  );
};

export default RegisterForm;