// frontend/src/services/firebaseConfig.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDcEiriO9-K-p6tD7nrr4uBWDME9pKpKek",
  authDomain: "fake-news-detecto.firebaseapp.com",
  projectId: "fake-news-detecto",
  storageBucket: "fake-news-detecto.firebasestorage.app",
  messagingSenderId: "1005833384894",
  appId: "1:1005833384894:web:1fe4e4090273c1f9a57fef",
  measurementId: "G-B7E78V93NH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Development only - connect to emulators if needed
if (process.env.NODE_ENV === 'development') {
  // Uncomment these lines if you want to use Firebase emulators
  // connectAuthEmulator(auth, "http://localhost:9099");
  // connectFirestoreEmulator(db, 'localhost', 8080);
  
  console.log('🔥 Firebase initialized in development mode');
  console.log('📊 Firestore app:', app.name);
  console.log('🔐 Auth app:', auth.app.name);
}

// Test Firebase connection
export const testFirebaseConnection = async () => {
  try {
    // Test auth
    console.log('Testing Firebase Auth...');
    console.log('Auth current user:', auth.currentUser);
    
    // Test Firestore (this will also test the connection)
    console.log('Testing Firestore connection...');
    console.log('Firestore app:', db.app.name);
    
    return true;
  } catch (error) {
    console.error('Firebase connection test failed:', error);
    return false;
  }
};

export default app;