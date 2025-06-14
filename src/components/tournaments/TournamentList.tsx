import React, { useState, useEffect } from 'react';
import { Trophy, Calendar, MapPin, Users, Plus, Search, Filter } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useTournaments } from '../../hooks/useTournaments';
import { useTournamentMutations } from '../../hooks/useTournamentMutations';
import LoadingSpinner from '../LoadingSpinner';
import TournamentCreateForm from '../TournamentCreateForm';
import { TournamentDetails } from './TournamentDetails';

export const TournamentList: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);

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

  if (selectedTournamentId) {
    return (
      <TournamentDetails 
        tournamentId={selectedTournamentId} 
        onBack={() => setSelectedTournamentId(null)} 
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error) {
    return <div className="p-4">Error loading tournaments: {error.message}</div>;
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h1 className="text-2xl font-bold mb-4 md:mb-0">Tournaments</h1>
        <button onClick={handleCreateTournament} className="btn btn-primary">
          <Plus size={16} className="mr-2" />
          Create Tournament
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search tournaments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="relative">
            <Filter size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
            >
              <option value="all">All Statuses</option>
              <option value="registration_open">Registration Open</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tournament Grid */}
      {filteredTournaments.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Trophy className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-lg font-medium text-gray-900">No Tournaments Found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'Be the first to create a tournament and bring players together!'}
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <button onClick={handleCreateTournament} className="mt-4 btn btn-primary">
              <Plus size={16} className="mr-2" />
              Create First Tournament
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTournaments.map((tournament) => (
            <div key={tournament.id} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-xl font-bold text-gray-900 mb-1">{tournament.name}</h2>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    tournament.status === 'registration_open' ? 'bg-green-100 text-green-800' :
                    tournament.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {formatStatus(tournament.status)}
                  </span>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="h-4 w-4 mr-2" />
                    {new Date(tournament.start_date).toLocaleDateString()}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <MapPin className="h-4 w-4 mr-2" />
                    {tournament.location}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Users className="h-4 w-4 mr-2" />
                    {tournament.participantCount || 0}/{tournament.max_participants} participants
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Trophy className="h-4 w-4 mr-2" />
                    <span className="capitalize">{tournament.format.replace('_', ' ')}</span>
                  </div>
                </div>
                
                {tournament.isRegistered && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-2 mb-4 text-sm text-green-800 flex items-center">
                    <Trophy className="h-4 w-4 mr-2" />
                    You're registered
                  </div>
                )}
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => setSelectedTournamentId(tournament.id)}
                    className="flex-1 btn btn-secondary"
                  >
                    View Details
                  </button>
                  
                  {tournament.status === 'registration_open' && 
                   !tournament.isRegistered && 
                   (tournament.participantCount || 0) < tournament.max_participants && (
                    <button
                      onClick={() => handleRegister(tournament.id)}
                      className="flex-1 btn btn-primary"
                      disabled={registerForTournament.isPending}
                    >
                      {registerForTournament.isPending ? 'Registering...' : 'Register'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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