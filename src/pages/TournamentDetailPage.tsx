import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import LoadingSpinner from '../components/LoadingSpinner';
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
  const [activeTab, setActiveTab] = useState<'overview' | 'participants' | 'matches'>('overview');
  
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
        
        setTournament(formattedTournament);

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
    <div className="bg-white rounded-lg shadow-md">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center mb-4">
          <button
            onClick={handleBack}
            className="mr-4 p-2 rounded-full hover:bg-gray-100"
          >
            <svg className="h-5 w-5 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{tournament.name}</h1>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <span className={`px-3 py-1 text-sm font-medium rounded-full ${
            tournament.status === 'registration_open' ? 'bg-green-100 text-green-800' :
            tournament.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {tournament.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </span>
          <div className="flex items-center text-sm text-gray-600">
            <svg className="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {new Date(tournament.startDate).toLocaleDateString()} - {new Date(tournament.endDate).toLocaleDateString()}
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <svg className="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {tournament.location}
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <svg className="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            {participants.length}/{tournament.maxParticipants} participants
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <svg className="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            <span className="capitalize">{tournament.format.replace('_', ' ')} format</span>
          </div>
        </div>
        
        <p className="text-gray-700">{tournament.description}</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-6 text-sm font-medium ${
              activeTab === 'overview'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('participants')}
            className={`py-4 px-6 text-sm font-medium ${
              activeTab === 'participants'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Participants ({participants.length})
          </button>
          <button
            onClick={() => setActiveTab('matches')}
            className={`py-4 px-6 text-sm font-medium ${
              activeTab === 'matches'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Matches ({matches.length})
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Tournament Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Tournament Details</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Format:</span>
                    <span className="font-medium text-gray-900 capitalize">{tournament.format.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Organizer:</span>
                    <span className="font-medium text-gray-900">{tournament.organizerId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Registration:</span>
                    <span className="font-medium text-gray-900">
                      {tournament.status === 'registration_open' ? 'Open' : 'Closed'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Registration Status</h3>
                <div className="mb-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Participants:</span>
                    <span className="font-medium text-gray-900">
                      {participants.length}/{tournament.maxParticipants}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full" 
                      style={{ width: `${(participants.length / tournament.maxParticipants) * 100}%` }}
                    ></div>
                  </div>
                </div>
                
                {isRegistered ? (
                  <div className="text-center">
                    <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4">
                      <p className="text-green-800 font-medium">You are registered for this tournament</p>
                    </div>
                    {tournament.status === 'registration_open' && (
                      <button
                        onClick={handleUnregister}
                        className="btn btn-secondary"
                        disabled={unregisterFromTournament.isPending}
                      >
                        {unregisterFromTournament.isPending ? 'Processing...' : 'Withdraw from Tournament'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-center">
                    {tournament.status === 'registration_open' && participants.length < tournament.maxParticipants ? (
                      <button
                        onClick={handleRegister}
                        className="btn btn-primary"
                        disabled={registerForTournament.isPending}
                      >
                        <svg className="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                        {registerForTournament.isPending ? 'Registering...' : 'Register for Tournament'}
                      </button>
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                        <p className="text-gray-700">
                          {participants.length >= tournament.maxParticipants
                            ? 'Tournament is full'
                            : 'Registration is closed'}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Schedule */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Tournament Schedule</h3>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <h4 className="text-base font-medium text-gray-900">Registration Period</h4>
                    <p className="text-gray-600">
                      Until {new Date(tournament.startDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <h4 className="text-base font-medium text-gray-900">Tournament Start</h4>
                    <p className="text-gray-600">
                      {new Date(tournament.startDate).toLocaleDateString()} at{' '}
                      {new Date(tournament.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <h4 className="text-base font-medium text-gray-900">Tournament End</h4>
                    <p className="text-gray-600">
                      {new Date(tournament.endDate).toLocaleDateString()} at{' '}
                      {new Date(tournament.endDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'participants' && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Registered Participants</h3>
            
            {participants.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <svg className="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No participants yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Be the first to register for this tournament.
                </p>
                {tournament.status === 'registration_open' && !isRegistered && (
                  <div className="mt-6">
                    <button
                      onClick={handleRegister}
                      className="btn btn-primary"
                      disabled={registerForTournament.isPending}
                    >
                      {registerForTournament.isPending ? 'Registering...' : 'Register Now'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Seed
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Player
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rating
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Registered
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {participants.map((participant, index) => (
                      <tr key={participant.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {participant.seed || index + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium">
                              {participant.player?.username.charAt(0).toUpperCase()}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {participant.player?.username}
                              </div>
                              {participant.player_id === user?.id && (
                                <div className="text-xs text-blue-600">You</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {participant.player?.elo_rating}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(participant.registered_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'matches' && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Tournament Matches</h3>
            
            {matches.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <svg className="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No matches scheduled yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Matches will be created when the tournament begins.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {matches.map((match) => (
                  <div
                    key={match.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-gray-900">
                        {match.player1?.username} vs {match.player2?.username}
                      </div>
                      <div className={`px-2 py-1 text-xs font-medium rounded-full ${
                        match.status === 'completed' ? 'bg-green-100 text-green-800' :
                        match.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {match.status.replace('_', ' ')}
                      </div>
                    </div>
                    <div className="flex items-center text-sm text-gray-600 mb-2">
                      <svg className="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {new Date(match.date).toLocaleDateString()} at{' '}
                      {new Date(match.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <svg className="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {match.location}
                    </div>
                    {match.status === 'completed' && match.score && (
                      <div className="mt-2 text-sm font-medium">
                        Score: <span className="text-blue-600">{match.score}</span>
                        {match.winner && (
                          <span className="ml-2 text-green-600">
                            ({match.winner.username} won)
                          </span>
                        )}
                      </div>
                    )}
                    <div className="mt-4 flex justify-end">
                      <button 
                        onClick={() => navigate(`/matches/${match.id}`)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
                      >
                        View Details
                        <svg className="h-4 w-4 ml-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TournamentDetailPage;