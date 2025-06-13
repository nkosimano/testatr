import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TournamentList } from '../components/tournaments/TournamentList';
import { supabase } from '../lib/supabase';
import LoadingSpinner from '../components/LoadingSpinner';
import TournamentDetailsPage from '../components/TournamentDetailsPage';
import { useAuthStore } from '../stores/authStore';
import { useTournamentMutations } from '../hooks/useTournamentMutations';

const TournamentsPage: React.FC = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { registerForTournament } = useTournamentMutations();
  const [tournament, setTournament] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tournamentId) {
      fetchTournamentDetails();
    }
  }, [tournamentId]);

  const fetchTournamentDetails = async () => {
    if (!tournamentId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select(`
          *,
          organizer:profiles!tournaments_organizer_id_fkey(username, elo_rating)
        `)
        .eq('id', tournamentId)
        .single();
        
      if (error) throw error;
      
      // Check if user is registered
      if (user) {
        const { data: registration } = await supabase
          .from('tournament_participants')
          .select('id')
          .eq('tournament_id', tournamentId)
          .eq('player_id', user.id)
          .maybeSingle();
          
        data.isRegistered = !!registration;
      }
      
      // Get participant count
      const { count } = await supabase
        .from('tournament_participants')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', tournamentId);
        
      data.participantCount = count || 0;
      
      setTournament(data);
    } catch (err: any) {
      console.error('Error fetching tournament details:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/tournaments');
  };

  const handleRegister = () => {
    if (!user || !tournament) return;
    
    registerForTournament.mutate(
      { tournamentId: tournament.id, playerId: user.id },
      {
        onSuccess: () => {
          // Update local state to reflect registration
          setTournament(prev => ({
            ...prev,
            isRegistered: true,
            participantCount: (prev.participantCount || 0) + 1
          }));
        }
      }
    );
  };

  // If we have a tournament ID but are still loading or have tournament data, show the details page
  if (tournamentId) {
    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="large" text="Loading tournament details..." />
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="max-w-4xl mx-auto p-6 text-center">
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-standard)' }}>Error Loading Tournament</h2>
          <p style={{ color: 'var(--text-subtle)' }}>{error}</p>
          <button 
            onClick={handleBack}
            className="mt-4 btn btn-primary"
          >
            Back to Tournaments
          </button>
        </div>
      );
    }
    
    if (tournament) {
      return (
        <TournamentDetailsPage 
          tournament={tournament} 
          onBack={handleBack}
          onRegister={handleRegister}
        />
      );
    }
  }

  // Otherwise show the tournament list
  return <TournamentList />;
};

export default TournamentsPage;