import React, { Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import Sidebar from './components/layout/Sidebar';
import { initSentry } from './lib/sentry';
import LoadingSpinner from './components/LoadingSpinner';

// Lazy load page components
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const MatchesPage = React.lazy(() => import('./pages/MatchesPage'));
const MatchDetailPage = React.lazy(() => import('./pages/MatchDetailPage'));
const TournamentsPage = React.lazy(() => import('./pages/TournamentsPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const RankingsPage = React.lazy(() => import('./pages/RankingsPage'));
const UmpirePage = React.lazy(() => import('./pages/UmpirePage'));
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const SignUpPage = React.lazy(() => import('./pages/SignUpPage'));
const ForgotPasswordPage = React.lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = React.lazy(() => import('./pages/ResetPasswordPage'));

// Import core styles only
import './styles/base.css';
import './styles/dark-mode.css';
import './styles/light-mode.css';
import './styles/animations.css';
import './styles/shared.css';
import './styles/sidebar.css';
import './styles/rankings.css';

// Import page-specific styles
import './styles/pages/login.css';
import './styles/pages/onboarding.css';
import './styles/pages/dashboard.css';
import './styles/pages/tournaments.css';
import './styles/pages/matches.css';
import './styles/pages/profile.css';
import './styles/pages/umpire.css';

// Import component-specific styles
import './styles/components/multi-select-calendar.css';
import './styles/components/tournament-form.css';

// Initialize Sentry
initSentry();

function App() {
  const { initialize, loading, user } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // You can still show a minimal loader for the initial auth check
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>;
  }

  // For authenticated users, show the app layout with sidebar
  if (user) {
    return (
      <AuthProvider>
        <ThemeProvider>
          <div className="app-layout">
            <Sidebar />
            <main className="app-main">
              <Suspense fallback={<LoadingSpinner size="large" />}>
                <Routes>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/matches" element={<MatchesPage />} />
                  <Route path="/matches/:matchId" element={<MatchDetailPage />} />
                  <Route path="/tournaments" element={<TournamentsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/rankings" element={<RankingsPage />} />
                  <Route path="/umpire" element={<UmpirePage />} />
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Suspense>
            </main>
          </div>
        </ThemeProvider>
      </AuthProvider>
    );
  }

  // For unauthenticated users, show auth routes
  return (
    <AuthProvider>
      <ThemeProvider>
        <div className="min-h-screen">
          <Suspense fallback={<LoadingSpinner size="large" />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignUpPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        </div>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;