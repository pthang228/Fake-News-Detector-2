import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { auth } from './firebaseConfig';
import type { User } from 'firebase/auth';

export const register = async (email: string, password: string, username: string): Promise<User> => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);

  if (auth.currentUser) {
    await updateProfile(auth.currentUser, { displayName: username });
  }
  return userCredential.user || '';
};

export const login = async (email: string, password: string): Promise<User> => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  
  return userCredential.user || '';
};

export const logout = async () => {
  await signOut(auth);
};
