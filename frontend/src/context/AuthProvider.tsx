import { useEffect, useState, useRef } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../services/firebase/firebaseConfig';
import { AuthContext } from './AuthContext';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);

  const allowAutoLogin = useRef(false);

  useEffect(() => {
    // Khôi phục trạng thái allowAutoLogin từ localStorage
    const savedAllowAutoLogin = localStorage.getItem('allowAutoLogin');
    const savedRole = localStorage.getItem('userRole');

    if (savedAllowAutoLogin === 'true') {
      allowAutoLogin.current = true;
    }

    // Theo dõi trạng thái authentication của Firebase
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser && allowAutoLogin.current) {
        // Nếu có user trong Firebase và đã được phép auto login
        setUser(firebaseUser);
        setRole(savedRole); // Restore role từ localStorage
      } else if (firebaseUser && !allowAutoLogin.current) {
        // Nếu có user trong Firebase nhưng chưa được xác nhận backend
        // Không tự động set user, chờ login thủ công
        setUser(null);
        setRole(null);
      } else {
        // Không có user trong Firebase
        setUser(null);
        setRole(null);
        allowAutoLogin.current = false;
        localStorage.removeItem('allowAutoLogin');
        localStorage.removeItem('userRole');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = (user: User, role: string) => {
    allowAutoLogin.current = true;
    localStorage.setItem('allowAutoLogin', 'true'); // Lưu vào localStorage
    localStorage.setItem('userRole', role); // lưu role
    setUser(user);
    setRole(role);
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setRole(null);
      allowAutoLogin.current = false;
      localStorage.removeItem('allowAutoLogin'); // Xóa khỏi localStorage
      localStorage.removeItem('userRole');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};