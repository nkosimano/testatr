import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { DataInitializationService } from './services/DataInitializationService';
import Sidebar from './components/layout/Sidebar';
import { initSentry } from './lib/sentry';
import LoadingSpinner from './components/LoadingSpinner';

// Import pages
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import DashboardPage from './pages/DashboardPage';
import MatchesPage from './pages/MatchesPage';
import TournamentsPage from './pages/TournamentsPage';
import ProfilePage from './pages/ProfilePage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import RankingsPage from './pages/RankingsPage';
import UmpirePage from './pages/UmpirePage';
import MatchDetailPage from './pages/MatchDetailPage';

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
  const [isDataReady, setIsDataReady] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      await initialize();
      
      try {
        await DataInitializationService.initializeAllData();
        setIsDataReady(true);
      } catch (error) {
        console.error('Data initialization failed:', error);
        setInitializationError('Failed to initialize application data. Please refresh the page.');
      }
    };
    
    init();
  }, [initialize]);

  if (loading || !isDataReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner 
          size="large" 
          text="Initializing Africa Tennis..." 
          subtext="Setting up your tennis experience"
        />
      </div>
    );
  }

  if (initializationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="text-center p-8">
          <div className="text-red-600 text-xl mb-4">⚠️ Initialization Error</div>
          <p className="text-red-700 mb-4">{initializationError}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  // For authenticated users, show the app layout with sidebar
  if (user) {
    return (
      <AuthProvider>
        <ThemeProvider>
          <div className="app-layout">
            <Sidebar />
            <main className="app-main">
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
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;