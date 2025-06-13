import React, { useEffect, useState } from 'react'
import { Trophy, Calendar, MapPin, Users, Plus, Search, Filter } from 'lucide-react'
import { useTournamentStore } from '../../stores/tournamentStore'
import { useAuthStore } from '../../stores/authStore'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../LoadingSpinner'
import TournamentCreateForm from '../TournamentCreateForm'
import type { Database } from '../../types/database'

type Tournament = Database['public']['Tables']['tournaments']['Row']

interface TournamentWithOrganizer extends Tournament {
  organizer?: { username: string }
  participantCount?: number
  isRegistered?: boolean
}

export const TournamentList: React.FC = () => {
  const [tournaments, setTournaments] = useState<TournamentWithOrganizer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showCreateForm, setShowCreateForm] = useState(false)
  
  const user = useAuthStore(state => state.user)
  const navigate = useNavigate()

  const fetchTournaments = async () => {
    setLoading(true)
    try {
      // Fetch tournaments with organizer info
      const { data: tournamentsData, error } = await supabase
        .from('tournaments')
        .select(`
          *,
          organizer:profiles!tournaments_organizer_id_fkey(username)
        `)
        .order('start_date', { ascending: true })

      if (error) throw error

      // Fetch participant counts for each tournament
      const tournamentsWithCounts = await Promise.all(
        (tournamentsData || []).map(async (tournament) => {
          // Get participant count
          const { count, error: countError } = await supabase
            .from('tournament_participants')
            .select('*', { count: 'exact', head: true })
            .eq('tournament_id', tournament.id)

          if (countError) throw countError

          // Check if user is registered
          let isRegistered = false
          if (user) {
            const { data: registration, error: regError } = await supabase
              .from('tournament_participants')
              .select('*')
              .eq('tournament_id', tournament.id)
              .eq('player_id', user.id)
              .maybeSingle()

            if (regError) throw regError
            isRegistered = !!registration
          }

          return {
            ...tournament,
            participantCount: count || 0,
            isRegistered
          }
        })
      )

      setTournaments(tournamentsWithCounts)
    } catch (error) {
      console.error('Error fetching tournaments:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTournaments()

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('tournaments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournaments'
        },
        () => {
          fetchTournaments()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [user])

  const filteredTournaments = tournaments.filter(tournament => {
    // Apply search filter
    const matchesSearch = 
      tournament.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tournament.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tournament.location.toLowerCase().includes(searchQuery.toLowerCase())
    
    // Apply status filter
    const matchesStatus = 
      statusFilter === 'all' || 
      tournament.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const handleRegister = async (tournamentId: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('tournament_participants')
        .insert({
          tournament_id: tournamentId,
          player_id: user.id
        })

      if (error) throw error

      // Refresh tournaments to update registration status
      fetchTournaments()
    } catch (error: any) {
      console.error('Error registering for tournament:', error)
      alert('Failed to register: ' + error.message)
    }
  }

  const handleCreateTournament = () => {
    setShowCreateForm(true)
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
          text="Loading tournaments..." 
          subtext="Retrieving tournament information"
        />
      </div>
    )
  }

  return (
    <div className="tournaments-page">
      <div className="tournaments-container">
        {/* Welcome Section */}
        <div className="tournaments-welcome">
          <h1 className="tournaments-welcome-title">
            <span className="tournaments-welcome-name">Tournaments</span>
          </h1>
          <p className="tournaments-welcome-subtitle">
            Compete in organized tournaments and prove your skills against the best players.
          </p>
        </div>

        {/* Create Tournament Button */}
        <div className="tournaments-create-section">
          <button 
            onClick={handleCreateTournament}
            className="tournaments-create-btn"
          >
            <Plus size={16} />
            Create Tournament
          </button>
        </div>

        {/* Filters and Search */}
        <div className="tournaments-filters">
          <div className="tournaments-filters-content">
            {/* Search Bar */}
            <div className="tournaments-search">
              <div className="tournaments-search-container">
                <Search size={20} className="tournaments-search-icon" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="tournaments-search-input"
                  placeholder="Search tournaments by name, location, or description..."
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="tournaments-filter-controls">
              <div className="relative">
                <Filter size={20} className="tournaments-filter-icon" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="form-select tournaments-filter-select"
                >
                  <option value="all">All Tournaments</option>
                  <option value="registration_open">Registration Open</option>
                  <option value="registration_closed">Registration Closed</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Tournaments Grid */}
        {filteredTournaments.length === 0 ? (
          <div className="tournaments-empty">
            <Trophy size={48} className="tournaments-empty-icon" />
            <h3 className="tournaments-empty-title">
              {searchQuery || statusFilter !== 'all' ? 'No tournaments found' : 'No tournaments available'}
            </h3>
            <p className="tournaments-empty-description">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'Be the first to create a tournament and bring players together!'
              }
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <button 
                onClick={handleCreateTournament}
                className="tournaments-empty-btn"
              >
                <Plus size={16} />
                Create First Tournament
              </button>
            )}
          </div>
        ) : (
          <div className="tournaments-grid">
            {filteredTournaments.map((tournament) => (
              <div
                key={tournament.id}
                className="tournament-card-minimal"
              >
                {/* Header with Title and Status */}
                <div className="tournament-card-header">
                  <div className="tournament-card-title-section">
                    <h3 className="tournament-card-title">{tournament.name}</h3>
                    <div 
                      className="tournament-card-status"
                      style={{ 
                        backgroundColor: `${tournament.status === 'registration_open' ? 'rgba(0, 255, 170, 0.2)' : 
                                          tournament.status === 'in_progress' ? 'rgba(0, 212, 255, 0.2)' : 
                                          'rgba(255, 149, 0, 0.2)'}`,
                        color: tournament.status === 'registration_open' ? 'var(--success-green)' : 
                              tournament.status === 'in_progress' ? 'var(--quantum-cyan)' : 
                              'var(--warning-orange)'
                      }}
                    >
                      {formatStatus(tournament.status)}
                    </div>
                  </div>
                </div>

                {/* Essential Info */}
                <div className="tournament-card-info">
                  <div className="tournament-card-info-item">
                    <Calendar size={14} />
                    <span>{new Date(tournament.start_date).toLocaleDateString()}</span>
                  </div>
                  <div className="tournament-card-info-item">
                    <MapPin size={14} />
                    <span>{tournament.location.split(',')[0]}</span>
                  </div>
                  <div className="tournament-card-info-item">
                    <Users size={14} />
                    <span>{tournament.participantCount}/{tournament.max_participants}</span>
                  </div>
                </div>

                {/* Registration Status Indicator */}
                {tournament.isRegistered && (
                  <div className="tournament-card-registered">
                    <Trophy size={14} />
                    <span>Registered</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="tournament-card-actions">
                  <button className="tournament-card-btn tournament-card-btn-secondary">
                    Details
                  </button>

                  {tournament.status === 'registration_open' &&
                   !tournament.isRegistered &&
                   tournament.participantCount < tournament.max_participants && (
                    <button
                      onClick={() => handleRegister(tournament.id)}
                      className="tournament-card-btn tournament-card-btn-primary"
                    >
                      Register
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Tournament Creation Form */}
      {showCreateForm && (
        <TournamentCreateForm
          onClose={() => setShowCreateForm(false)}
          onTournamentCreated={() => {
            setShowCreateForm(false);
            fetchTournaments();
          }}
        />
      )}
    </div>
  )
}