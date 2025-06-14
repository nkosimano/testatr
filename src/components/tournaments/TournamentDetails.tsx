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
        return 'text-success-green bg-success-green bg-opacity-10'
      case 'registration_closed':
        return 'text-warning-orange bg-warning-orange bg-opacity-10'
      case 'in_progress':
        return 'text-quantum-cyan bg-quantum-cyan bg-opacity-10'
      case 'completed':
        return 'text-text-muted bg-text-muted bg-opacity-10'
      case 'cancelled':
        return 'text-error-pink bg-error-pink bg-opacity-10'
      default:
        return 'text-text-muted bg-text-muted bg-opacity-10'
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
        <h3 className="text-lg font-medium text-text-standard">Tournament not found</h3>
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
    <div className="tournament-details-page">
      <div className="tournament-details-container">
        {/* Header */}
        <div className="tournament-details-header">
          <button
            onClick={onBack}
            className="tournament-details-back-btn"
          >
            <ArrowLeft size={20} />
          </button>
          
          <div className="tournament-details-title-section">
            <h1 className="tournament-details-title">{tournament.name}</h1>
            <div 
              className={`tournament-details-status ${getStatusColor(tournament.status)}`}
            >
              {formatStatus(tournament.status)}
            </div>
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <div className="tournament-details-tabs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`tournament-details-tab ${activeTab === 'overview' ? 'active' : ''}`}
          >
            <Trophy size={16} />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('participants')}
            className={`tournament-details-tab ${activeTab === 'participants' ? 'active' : ''}`}
          >
            <Users size={16} />
            Players ({participants.length})
          </button>
          <button
            onClick={() => setActiveTab('matches')}
            className={`tournament-details-tab ${activeTab === 'matches' ? 'active' : ''}`}
          >
            <Clock size={16} />
            Matches ({matches.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="tournament-details-content">
          {activeTab === 'overview' && (
            <div className="tournament-details-overview">
              {/* Tournament Info */}
              <div className="tournament-info-grid">
                <div className="tournament-info-card">
                  <div className="tournament-info-header">
                    <Calendar size={20} />
                    <span>Schedule</span>
                  </div>
                  <div className="tournament-info-content">
                    <div className="tournament-info-item">
                      <span className="tournament-info-label">Registration Deadline:</span>
                      <span className="tournament-info-value">
                        {new Date(tournament.start_date).toLocaleDateString()} at{' '}
                        {new Date(tournament.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="tournament-info-item">
                      <span className="tournament-info-label">Tournament Start:</span>
                      <span className="tournament-info-value">
                        {new Date(tournament.start_date).toLocaleDateString()} at{' '}
                        {new Date(tournament.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="tournament-info-item">
                      <span className="tournament-info-label">Tournament End:</span>
                      <span className="tournament-info-value">
                        {new Date(tournament.end_date).toLocaleDateString()} at{' '}
                        {new Date(tournament.end_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="tournament-info-card">
                  <div className="tournament-info-header">
                    <Trophy size={20} />
                    <span>Format & Rules</span>
                  </div>
                  <div className="tournament-info-content">
                    <div className="tournament-info-item">
                      <span className="tournament-info-label">Format:</span>
                      <span className="tournament-info-value capitalize">{tournament.format.replace('_', ' ')}</span>
                    </div>
                    <div className="tournament-info-item">
                      <span className="tournament-info-label">Max Participants:</span>
                      <span className="tournament-info-value">{tournament.max_participants} players</span>
                    </div>
                    <div className="tournament-info-item">
                      <span className="tournament-info-label">Current Registration:</span>
                      <span className="tournament-info-value">
                        {participants.length}/{tournament.max_participants} players
                      </span>
                    </div>
                  </div>
                </div>

                <div className="tournament-info-card">
                  <div className="tournament-info-header">
                    <MapPin size={20} />
                    <span>Location & Officials</span>
                  </div>
                  <div className="tournament-info-content">
                    <div className="tournament-info-item">
                      <span className="tournament-info-label">Venue:</span>
                      <span className="tournament-info-value">{tournament.location}</span>
                    </div>
                    <div className="tournament-info-item">
                      <span className="tournament-info-label">Organizer:</span>
                      <span className="tournament-info-value">{organizer?.username || 'Unknown'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Registration Progress */}
              <div className="tournament-registration-progress">
                <div className="tournament-progress-header">
                  <h3>Registration Progress</h3>
                  <span className="tournament-progress-count">
                    {participants.length}/{tournament.max_participants} players
                  </span>
                </div>
                <div className="tournament-progress-bar">
                  <div 
                    className="tournament-progress-fill"
                    style={{ 
                      width: `${(participants.length / tournament.max_participants) * 100}%`,
                      backgroundColor: participants.length === tournament.max_participants ? 'var(--success-green)' : 'var(--quantum-cyan)'
                    }}
                  />
                </div>
                <div className="tournament-progress-percentage">
                  {Math.round((participants.length / tournament.max_participants) * 100)}% Full
                </div>
              </div>

              {/* Description */}
              <div className="tournament-description-card">
                <h3>About This Tournament</h3>
                <p>{tournament.description}</p>
              </div>

              {/* Format Explanation */}
              <div className="tournament-format-card">
                <h3>
                  <Trophy size={20} className="inline-icon mr-2" />
                  Single Elimination Format
                </h3>
                <div className="format-explanation">
                  <p>
                    In this single elimination tournament, players compete in a knockout format. Lose once and you're eliminated from the competition.
                  </p>
                  <ul className="format-features">
                    <li>Players are seeded based on their ratings</li>
                    <li>Each match has one winner who advances to the next round</li>
                    <li>The tournament champion is the last player standing</li>
                    <li>Fast-paced format with clear progression</li>
                  </ul>
                </div>
              </div>

              {/* Registration Status */}
              {isRegistered && (
                <div className="tournament-registration-status registered">
                  <div className="tournament-status-content">
                    <div className="flex items-center gap-2">
                      <div className="text-success-green">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                          <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                      </div>
                      <div>
                        <div className="tournament-status-title">You're Registered!</div>
                        <div className="tournament-status-subtitle">
                          You're all set for this tournament. Check back for bracket updates.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!isRegistered && tournament.status === 'registration_open' && (
                <div className="tournament-registration-status can-register">
                  <div className="tournament-status-content">
                    <div className="flex items-center gap-2">
                      <div className="text-quantum-cyan">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="8" x2="12" y2="16"></line>
                          <line x1="8" y1="12" x2="16" y2="12"></line>
                        </svg>
                      </div>
                      <div>
                        <div className="tournament-status-title">
                          Registration Open
                        </div>
                        <div className="tournament-status-subtitle">
                          Join this tournament and compete against other players!
                        </div>
                      </div>
                    </div>
                  </div>
                  <button onClick={handleRegister} className="btn btn-primary btn-glare">
                    <Target size={16} className="mr-2" />
                    Register Now
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'participants' && (
            <div className="tournament-participants">
              <h3 className="text-xl font-bold mb-4">Registered Participants</h3>
              
              {participants.length === 0 ? (
                <div className="tournament-participants-empty">
                  <Users size={48} />
                  <h3>No Players Registered Yet</h3>
                  <p>Be the first to register for this tournament!</p>
                </div>
              ) : (
                <div className="tournament-participants-grid">
                  {participants.map((participant) => (
                    <div key={participant.id} className="tournament-participant-card">
                      <div className="tournament-participant-info">
                        <div className="tournament-participant-avatar">
                          {participant.player?.username.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="tournament-participant-details">
                          <div className="tournament-participant-name">{participant.player?.username || 'Unknown Player'}</div>
                          <div className="tournament-participant-skill">Rating: {participant.player?.elo_rating || '?'}</div>
                        </div>
                      </div>
                      
                      <div className="tournament-participant-stats">
                        {participant.seed && (
                          <div className="tournament-participant-seed">
                            <span className="tournament-participant-seed-value">#{participant.seed}</span>
                            <span className="tournament-participant-seed-label">Seed</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {tournament.status === 'registration_open' && !isRegistered && (
                <div className="mt-6 text-center">
                  <button
                    onClick={handleRegister}
                    className="btn btn-primary btn-glare"
                  >
                    <Target size={16} className="mr-2" />
                    Register Now
                  </button>
                </div>
              )}
              
              {isRegistered && tournament.status === 'registration_open' && (
                <div className="mt-6 text-center">
                  <button
                    onClick={handleUnregister}
                    className="btn btn-ghost"
                  >
                    Withdraw from Tournament
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'matches' && (
            <div>
              <h3 className="text-xl font-bold mb-4">Tournament Matches</h3>
              
              {matches.length === 0 ? (
                <div className="tournament-bracket-empty">
                  <Trophy size={48} />
                  <h3>No matches scheduled yet</h3>
                  <p>Matches will be created when the tournament begins.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {matches.map((match) => (
                    <div
                      key={match.id}
                      className="tournament-bracket-match"
                    >
                      <div className="tournament-bracket-match-header">
                        <div className="tournament-bracket-match-number">
                          Match {match.id.slice(-4)}
                        </div>
                        <div className={`tournament-bracket-match-status ${match.status}`}>
                          {match.status === 'completed' && <CheckCircle size={14} />}
                          {match.status === 'in_progress' && <Play size={14} />}
                          {match.status === 'pending' && <Clock size={14} />}
                          <span className="ml-1 capitalize">{match.status.replace('_', ' ')}</span>
                        </div>
                      </div>
                      
                      <div className="tournament-bracket-match-players">
                        <div className={`tournament-bracket-player ${match.winner_id === match.player1_id ? 'winner' : ''}`}>
                          <span className="tournament-bracket-player-name">
                            {match.player1?.username || 'TBD'}
                          </span>
                          {match.score && match.winner_id === match.player1_id && (
                            <Award size={14} className="tournament-bracket-winner-icon" />
                          )}
                        </div>
                        
                        <div className="tournament-bracket-vs">vs</div>
                        
                        <div className={`tournament-bracket-player ${match.winner_id === match.player2_id ? 'winner' : ''}`}>
                          <span className="tournament-bracket-player-name">
                            {match.player2?.username || 'TBD'}
                          </span>
                          {match.score && match.winner_id === match.player2_id && (
                            <Award size={14} className="tournament-bracket-winner-icon" />
                          )}
                        </div>
                      </div>
                      
                      {match.score && (
                        <div className="tournament-bracket-match-score">
                          Score: {match.score}
                        </div>
                      )}
                      
                      <div className="tournament-bracket-match-time">
                        {new Date(match.date).toLocaleDateString()} at{' '}
                        {new Date(match.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}