import React, { useState, useEffect } from 'react'
import { ArrowLeft, Calendar, MapPin, Trophy, Users, Clock, Target, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../LoadingSpinner'
import { useAuthStore } from '../../stores/authStore'
import type { Database } from '../../types/database'

type Tournament = Database['public']['Tables']['tournaments']['Row']
type TournamentParticipant = Database['public']['Tables']['tournament_participants']['Row'] & {
  player?: { username: string; elo_rating: number }
}
type Match = Database['public']['Tables']['matches']['Row'] & {
  player1?: { username: string }
  player2?: { username: string }
  winner?: { username: string }
}

interface TournamentDetailsProps {
  tournamentId: string
  onBack: () => void
}

export const TournamentDetails: React.FC<TournamentDetailsProps> = ({ tournamentId, onBack }) => {
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [participants, setParticipants] = useState<TournamentParticipant[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [organizer, setOrganizer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isRegistered, setIsRegistered] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'participants' | 'matches'>('overview')
  
  const user = useAuthStore(state => state.user)

  useEffect(() => {
    const fetchTournamentDetails = async () => {
      setLoading(true)
      try {
        // Fetch tournament data
        const { data: tournamentData, error: tournamentError } = await supabase
          .from('tournaments')
          .select(`
            *,
            organizer:profiles!tournaments_organizer_id_fkey(username, elo_rating)
          `)
          .eq('id', tournamentId)
          .single()

        if (tournamentError) throw tournamentError
        setTournament(tournamentData)
        setOrganizer(tournamentData.organizer)

        // Fetch participants
        const { data: participantsData } = await supabase
          .from('tournament_participants')
          .select(`
            *,
            player:profiles!tournament_participants_player_id_fkey(username, elo_rating)
          `)
          .eq('tournament_id', tournamentId)
          .order('seed', { ascending: true })

        setParticipants(participantsData || [])

        // Check if user is registered
        if (user) {
          const isUserRegistered = (participantsData || []).some(
            p => p.player_id === user.id
          )
          setIsRegistered(isUserRegistered)
        }

        // Fetch tournament matches
        const { data: matchesData } = await supabase
          .from('matches')
          .select(`
            *,
            player1:profiles!matches_player1_id_fkey(username),
            player2:profiles!matches_player2_id_fkey(username),
            winner:profiles!matches_winner_id_fkey(username)
          `)
          .eq('tournament_id', tournamentId)
          .order('date', { ascending: true })

        setMatches(matchesData || [])
      } catch (error) {
        console.error('Error fetching tournament details:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTournamentDetails()
  }, [tournamentId, user])

  const handleRegister = async () => {
    if (!user || !tournament) return

    try {
      const { error } = await supabase
        .from('tournament_participants')
        .insert({
          tournament_id: tournament.id,
          player_id: user.id
        })

      if (error) throw error

      // Refresh participants
      const { data } = await supabase
        .from('tournament_participants')
        .select(`
          *,
          player:profiles!tournament_participants_player_id_fkey(username, elo_rating)
        `)
        .eq('tournament_id', tournamentId)
        .order('seed', { ascending: true })

      setParticipants(data || [])
      setIsRegistered(true)
    } catch (error: any) {
      console.error('Error registering for tournament:', error)
      alert('Failed to register: ' + error.message)
    }
  }

  const handleUnregister = async () => {
    if (!user || !tournament) return

    try {
      const { error } = await supabase
        .from('tournament_participants')
        .delete()
        .eq('tournament_id', tournament.id)
        .eq('player_id', user.id)

      if (error) throw error

      // Refresh participants
      const { data } = await supabase
        .from('tournament_participants')
        .select(`
          *,
          player:profiles!tournament_participants_player_id_fkey(username, elo_rating)
        `)
        .eq('tournament_id', tournamentId)
        .order('seed', { ascending: true })

      setParticipants(data || [])
      setIsRegistered(false)
    } catch (error: any) {
      console.error('Error unregistering from tournament:', error)
      alert('Failed to unregister: ' + error.message)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'registration_open':
        return 'bg-green-100 text-green-800'
      case 'registration_closed':
        return 'bg-yellow-100 text-yellow-800'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-gray-100 text-gray-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner 
          size="large" 
          text="Loading tournament details..." 
          subtext="Retrieving tournament information"
        />
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">Tournament not found</h3>
        <button
          onClick={onBack}
          className="mt-4 btn btn-primary"
        >
          Go Back
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center mb-4">
          <button
            onClick={onBack}
            className="mr-4 p-2 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{tournament.name}</h1>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(tournament.status)}`}>
            {formatStatus(tournament.status)}
          </span>
          <div className="flex items-center text-sm text-gray-600">
            <Calendar className="h-4 w-4 mr-2" />
            {new Date(tournament.start_date).toLocaleDateString()} - {new Date(tournament.end_date).toLocaleDateString()}
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <MapPin className="h-4 w-4 mr-2" />
            {tournament.location}
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <Users className="h-4 w-4 mr-2" />
            {participants.length}/{tournament.max_participants} participants
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <Trophy className="h-4 w-4 mr-2" />
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
                    <span className="font-medium text-gray-900">{organizer?.username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Registration:</span>
                    <span className="font-medium text-gray-900">
                      {tournament.status === 'registration_open' ? 'Open' : 'Closed'}
                    </span>
                  </div>
                  {tournament.entry_fee && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Entry Fee:</span>
                      <span className="font-medium text-gray-900">${tournament.entry_fee}</span>
                    </div>
                  )}
                  {tournament.prize_pool && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Prize Pool:</span>
                      <span className="font-medium text-gray-900">${tournament.prize_pool}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Registration Status</h3>
                <div className="mb-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Participants:</span>
                    <span className="font-medium text-gray-900">
                      {participants.length}/{tournament.max_participants}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full" 
                      style={{ width: `${(participants.length / tournament.max_participants) * 100}%` }}
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
                      >
                        Withdraw from Tournament
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-center">
                    {tournament.status === 'registration_open' && participants.length < tournament.max_participants ? (
                      <button
                        onClick={handleRegister}
                        className="btn btn-primary"
                      >
                        <Target className="h-5 w-5 mr-2" />
                        Register for Tournament
                      </button>
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                        <p className="text-gray-700">
                          {participants.length >= tournament.max_participants
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
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div className="ml-4">
                    <h4 className="text-base font-medium text-gray-900">Registration Period</h4>
                    <p className="text-gray-600">
                      Until {new Date(tournament.start_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div className="ml-4">
                    <h4 className="text-base font-medium text-gray-900">Tournament Start</h4>
                    <p className="text-gray-600">
                      {new Date(tournament.start_date).toLocaleDateString()} at{' '}
                      {new Date(tournament.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <Trophy className="h-5 w-5" />
                  </div>
                  <div className="ml-4">
                    <h4 className="text-base font-medium text-gray-900">Tournament End</h4>
                    <p className="text-gray-600">
                      {new Date(tournament.end_date).toLocaleDateString()} at{' '}
                      {new Date(tournament.end_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                <Users className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No participants yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Be the first to register for this tournament.
                </p>
                {tournament.status === 'registration_open' && !isRegistered && (
                  <div className="mt-6">
                    <button
                      onClick={handleRegister}
                      className="btn btn-primary"
                    >
                      Register Now
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
                <Trophy className="mx-auto h-12 w-12 text-gray-400" />
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
                      <Calendar className="h-4 w-4 mr-2" />
                      {new Date(match.date).toLocaleDateString()} at{' '}
                      {new Date(match.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPin className="h-4 w-4 mr-2" />
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
                      <button className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center">
                        View Details
                        <ChevronRight className="h-4 w-4 ml-1" />
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
  )
}