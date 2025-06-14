import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { TournamentDetails } from '../components/tournaments/TournamentDetails';
import { apiClient } from '../lib/aws';

const TournamentDetailPage: React.FC = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingTimeout, setLoadingTimeout] = useState<boolean>(false);
  
  const { user } = useAuthStore();

  useEffect(() => {
    // Set a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (loading) {
        setLoadingTimeout(true);
      }
    }, 15000); // 15 seconds timeout

    return () => clearTimeout(timeoutId);
  }, [loading]);

  if (!tournamentId) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium" style={{ color: 'var(--error-pink)' }}>
          Tournament ID is missing
        </h3>
        <button
          onClick={() => navigate('/tournaments')}
          className="mt-4 btn btn-primary"
        >
          Go Back to Tournaments
        </button>
      </div>
    );
  }

  const handleBack = () => {
    navigate('/tournaments');
  };

  // Show loading timeout message
  if (loadingTimeout) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium" style={{ color: 'var(--warning-orange)' }}>
          Loading is taking longer than expected
        </h3>
        <p className="mt-2 mb-4" style={{ color: 'var(--text-subtle)' }}>
          There might be an issue with the tournament data. You can try:
        </p>
        <div className="flex flex-col gap-3 items-center">
          <button
            onClick={() => {
              setLoadingTimeout(false);
              setLoading(true);
              window.location.reload();
            }}
            className="btn btn-primary"
          >
            Refresh Page
          </button>
          <button
            onClick={() => navigate('/tournaments')}
            className="btn btn-ghost"
          >
            Go Back to Tournaments
          </button>
        </div>
      </div>
    );
  }

  return (
    <TournamentDetails
      tournamentId={tournamentId}
      onBack={handleBack}
    />
  );
};

export default TournamentDetailPage;