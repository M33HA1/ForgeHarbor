import React from "react";
import { BrowserRouter as Router, Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import LandingPage from "./pages/LandingPage";
import DashboardPage from "./pages/DashboardPage";
import HistoryPage from "./pages/HistoryPage";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import SignupPage from "./pages/SignupPage";
import Header from "./components/Layout/Header";
import Footer from "./components/Layout/Footer";
import ProtectedRoute from "./components/ProtectedRoute";

const AppLayout = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const workspace = Boolean(user) && pathname.startsWith('/app/');
  return (
        <div className={workspace ? 'app-shell workspace-shell' : 'app-shell public-shell'}>
          <a className="skip-link" href="#main-content">Skip to content</a>
          <div className="flex-1 relative flex flex-col">
            <Header workspace={workspace} />
            <main id="main-content" tabIndex={-1} className={workspace ? 'workspace-main' : 'public-main'}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
                <Route path="/profile" element={<Navigate to="/app/profile" replace />} />
                <Route path="/history" element={<Navigate to="/app/history" replace />} />
                <Route path="/app/dashboard" element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                } />
                <Route path="/app/history" element={
                  <ProtectedRoute>
                    <HistoryPage />
                  </ProtectedRoute>
                } />
                <Route path="/app/profile" element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                } />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="*" element={<section className="auth-card" style={{maxWidth:520,margin:'40px auto'}}><h1>Page not found</h1><p>This address does not lead to a ForgeHarbor page.</p><Link className="primary-button" to={user ? '/app/dashboard' : '/'}>Return to {user ? 'workspace' : 'home'}</Link></section>} />
              </Routes>
            </main>
            <Footer workspace={workspace} />
          </div>
        </div>
  );
};

const App = () => <AuthProvider><Router><AppLayout /></Router></AuthProvider>;

export default App;
