import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import LoadingSpinner from '../components/LoadingSpinner';
import TournamentDetailsPage from '../components/TournamentDetailsPage';
import { Tournament } from '../types';
import { useTournamentMutations } from '../hooks/useTournamentMutations';

const TournamentDetailPage: React.FC = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  
  const { user } = useAuthStore();
  const { registerForTournament, unregisterFromTournament } = useTournamentMutations();

  useEffect(() => {
    const fetchTournamentDetails = async () => {
      if (!tournamentId) return;
      
      setLoading(true);
      try {
        // Fetch tournament data
        const { data: tournamentData, error: tournamentError } = await supabase
          .from('tournaments')
          .select(`
            *,
            organizer:profiles!tournaments_organizer_id_fkey(username, elo_rating)
          `)
          .eq('id', tournamentId)
          .single();

        if (tournamentError) throw tournamentError;
        
        // Convert to our app's Tournament type
        const formattedTournament: Tournament = {
          id: tournamentData.id,
          name: tournamentData.name,
          description: tournamentData.description,
          organizerId: tournamentData.organizer_id,
          startDate: tournamentData.start_date,
          endDate: tournamentData.end_date,
          registrationDeadline: tournamentData.start_date, // Using start_date as registration deadline
          format: tournamentData.format,
          location: tournamentData.location,
          maxParticipants: tournamentData.max_participants,
          status: tournamentData.status,
          umpireId: '', // This field might not be in the database yet
          createdAt: tournamentData.created_at,
          participantCount: 0, // Will be updated below
        };

        // Fetch participants
        const { data: participantsData, error: participantsError } = await supabase
          .from('tournament_participants')
          .select(`
            *,
            player:profiles!tournament_participants_player_id_fkey(username, elo_rating)
          `)
          .eq('tournament_id', tournamentId)
          .order('seed', { ascending: true });

        if (participantsError) throw participantsError;
        
        setParticipants(participantsData || []);
        
        // Update tournament with participant count
        formattedTournament.participantCount = participantsData?.length || 0;

        // Check if user is registered
        if (user) {
          const isUserRegistered = (participantsData || []).some(
            p => p.player_id === user.id
          );
          setIsRegistered(isUserRegistered);
          formattedTournament.isRegistered = isUserRegistered;
        }

        setTournament(formattedTournament);

        // Fetch tournament matches
        const { data: matchesData, error: matchesError } = await supabase
          .from('matches')
          .select(`
            *,
            player1:profiles!matches_player1_id_fkey(username),
            player2:profiles!matches_player2_id_fkey(username),
            winner:profiles!matches_winner_id_fkey(username)
          `)
          .eq('tournament_id', tournamentId)
          .order('date', { ascending: true });

        if (matchesError) throw matchesError;
        setMatches(matchesData || []);
        
      } catch (err: any) {
        console.error('Error fetching tournament details:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTournamentDetails();
    
    // Set up real-time subscription for tournament updates
    const tournamentSubscription = supabase
      .channel(`tournament-${tournamentId}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'tournaments', filter: `id=eq.${tournamentId}` },
        fetchTournamentDetails
      )
      .subscribe();
      
    // Set up real-time subscription for participants updates
    const participantsSubscription = supabase
      .channel(`tournament-participants-${tournamentId}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'tournament_participants', filter: `tournament_id=eq.${tournamentId}` },
        fetchTournamentDetails
      )
      .subscribe();
      
    // Set up real-time subscription for matches updates
    const matchesSubscription = supabase
      .channel(`tournament-matches-${tournamentId}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${tournamentId}` },
        fetchTournamentDetails
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(tournamentSubscription);
      supabase.removeChannel(participantsSubscription);
      supabase.removeChannel(matchesSubscription);
    };
  }, [tournamentId, user?.id]);

  const handleRegister = () => {
    if (!user || !tournament) return;
    registerForTournament.mutate({ 
      tournamentId: tournament.id, 
      playerId: user.id 
    });
  };

  const handleUnregister = () => {
    if (!user || !tournament) return;
    unregisterFromTournament.mutate({ 
      tournamentId: tournament.id, 
      playerId: user.id 
    });
  };

  const handleBack = () => {
    navigate('/tournaments');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner 
          size="large" 
          text="Loading tournament details..." 
          subtext="Retrieving tournament information"
        />
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium" style={{ color: 'var(--error-pink)' }}>
          {error || "Tournament not found"}
        </h3>
        <button
          onClick={handleBack}
          className="mt-4 btn btn-primary"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <TournamentDetailsPage
      tournament={tournament}
      participants={participants}
      matches={matches}
      onBack={handleBack}
      onRegister={handleRegister}
    />
  );
};

export default TournamentDetailPage;