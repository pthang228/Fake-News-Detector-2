import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Navbar from './components/layout/Navbar';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import AboutPage from './pages/AboutPage';
import UnauthorizedForm from './components/auth/UnauthorizedForm';

import ProtectedRoute from './components/routes/ProtectedRoute';
import PublicRoute from './components/routes/PublicRoute';
import AnalyticsPage from './pages/AnalyticsPage';
import HistoryPage from './pages/HistoryPage';

import './App.css';
import UnauthorizedPage from './pages/UnauthorizedPage';

const App: React.FC = () => {
  return (
    <Router>
      <div className="App">
        {/* Background animated elements */}
        <div className="bg-animation">
          <div className="floating-shape shape-1"></div>
          <div className="floating-shape shape-2"></div>
          <div className="floating-shape shape-3"></div>
          <div className="floating-shape shape-4"></div>
        </div>
        
        {/* Main content wrapper */}
        <div className="app-content">
          <Navbar />
          
          <main className="main-container">
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />

              <Route
                path="/login"
                element={
                  <PublicRoute>
                    <LoginPage />
                  </PublicRoute>
                }
              />

              <Route
                path="/register"
                element={
                  <PublicRoute>
                    <RegisterPage />
                  </PublicRoute>
                }
              />

              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/about"
                element={
                  <ProtectedRoute requiredRole={['user', 'admin']}>
                    <AboutPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/analysis"
                element={
                  <ProtectedRoute requiredRole={['user', 'admin']}>
                    <AnalyticsPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/history"
                element={
                  <ProtectedRoute requiredRole={['user', 'admin']}>
                    <HistoryPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/unauthorized"
                element={
                  <ProtectedRoute requiredRole={['user']}>
                    <UnauthorizedPage/>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
};

export default App;