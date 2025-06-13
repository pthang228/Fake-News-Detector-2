// src/context/AuthContext.tsx
import { createContext } from 'react';
// import type { User } from 'firebase/auth'; 
import type { User } from 'firebase/auth'; // import User type from Firebase

interface AuthContextType {
  user: User | null;
  role: string | null;
  login: (user: User, role: string) => void;
  logout: () => void;
  loading: boolean;  // thêm loading state
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);