import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export const useAuth = () => {
  const context = useContext(AuthContext);
  console.log('useAuth context:', context?.user?.email);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
