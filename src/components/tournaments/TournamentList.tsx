import React, { useState } from 'react';
import { Trophy, Calendar, MapPin, Users, Plus, Search, Filter } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useTournaments } from '../../hooks/useTournaments';
import { useTournamentMutations } from '../../hooks/useTournamentMutations';
import LoadingSpinner from '../LoadingSpinner';
import TournamentCreateForm from '../TournamentCreateForm';

export const TournamentList: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const user = useAuthStore((state) => state.user);
  const { tournaments, isLoading, error } = useTournaments();
  const { registerForTournament } = useTournamentMutations();

  const handleRegister = (tournamentId: string) => {
    if (!user) return;
    registerForTournament.mutate({ tournamentId, playerId: user.id });
  };

  const handleCreateTournament = () => {
    setShowCreateForm(true);
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const filteredTournaments = (tournaments || []).filter((tournament) => {
    const matchesSearch =
      tournament.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tournament.description && tournament.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      tournament.location.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || tournament.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="tournaments-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error) {
    return <div className="tournaments-container">Error loading tournaments.</div>;
  }

  return (
    <div className="tournaments-container">
      {/* Header */}
      <div className="tournaments-header">
        <h1 className="tournaments-title">Tournaments</h1>
        <button onClick={handleCreateTournament} className="tournaments-create-btn">
          <Plus size={16} />
          Create Tournament
        </button>
      </div>

      {/* Filters */}
      <div className="tournaments-filters">
        <div className="tournaments-search-wrapper">
          <Search size={18} className="tournaments-search-icon" />
          <input
            type="text"
            placeholder="Search tournaments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="tournaments-search-input"
          />
        </div>
        <div className="tournaments-status-filter">
          <Filter size={16} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="tournaments-status-select"
          >
            <option value="all">All Statuses</option>
            <option value="registration_open">Registration Open</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Tournament Grid */}
      <div className="tournaments-grid-container">
        {filteredTournaments.length === 0 ? (
          <div className="tournaments-empty-state">
            <Trophy size={48} />
            <h3 className="tournaments-empty-title">No Tournaments Found</h3>
            <p className="tournaments-empty-text">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'Be the first to create a tournament and bring players together!'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <button onClick={handleCreateTournament} className="tournaments-empty-btn">
                <Plus size={16} />
                Create First Tournament
              </button>
            )}
          </div>
        ) : (
          <div className="tournaments-grid">
            {filteredTournaments.map((tournament) => (
              <div key={tournament.id} className="tournament-card-minimal">
                {/* Header with Title and Status */}
                <div className="tournament-card-header">
                  <div className="tournament-card-title-section">
                    <h3 className="tournament-card-title">{tournament.name}</h3>
                    <div
                      className="tournament-card-status"
                      style={{
                        backgroundColor: `${
                          tournament.status === 'registration_open'
                            ? 'rgba(0, 255, 170, 0.2)'
                            : tournament.status === 'in_progress'
                            ? 'rgba(0, 212, 255, 0.2)'
                            : 'rgba(255, 149, 0, 0.2)'
                        }`,
                        color:
                          tournament.status === 'registration_open'
                            ? 'var(--success-green)'
                            : tournament.status === 'in_progress'
                            ? 'var(--quantum-cyan)'
                            : 'var(--warning-orange)',
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
                    (tournament.participantCount ?? 0) < tournament.max_participants && (
                      <button
                        onClick={() => handleRegister(tournament.id)}
                        className="tournament-card-btn tournament-card-btn-primary"
                        disabled={registerForTournament.isPending}
                      >
                        {registerForTournament.isPending ? 'Registering...' : 'Register'}
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
            // No need to manually refetch, React Query handles it
          }}
        />
      )}
    </div>
  );
};