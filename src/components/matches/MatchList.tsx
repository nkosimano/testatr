import React, { useState, useMemo } from 'react';
import { Search, Filter, Trophy, Clock, Plus, Swords } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useMatches } from '../../hooks/useMatches';
import { useMatchMutations } from '../../hooks/useMatchMutations';
import MatchCard from '../MatchCard';
import CreateMatchModal from './CreateMatchModal';
import ScoreModal from '../ScoreModal';
import { useNavigate } from 'react-router-dom';
import { Match } from '../../types';
import LoadingSpinner from '../LoadingSpinner';

export const MatchList: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Match['status']>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'upcoming' | 'recent'>('all');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { user } = useAuthStore();
  const { data: rawMatches = [], isLoading } = useMatches(user?.id);
  const navigate = useNavigate();

  const matches: Match[] = useMemo(() => {
    if (!rawMatches) return [];
    // Map the raw data to our Match type
    return rawMatches.map((m: any) => ({
      id: m.id,
      date: m.date,
      location: m.location,
      status: m.status,
      score: m.score,
      player1: m.player1,
      player2: m.player2,
      winnerProfile: m.winner,
      challengerId: m.player1_id,
      challengedId: m.player2_id,
      createdAt: m.created_at,
      challengerScore: m.challenger_score,
      challengedScore: m.challenged_score,
      winner: m.winner_id,
      detailedStatsId: m.detailed_stats_id,
      scoreDisplay: m.score_display,
    }));
  }, [rawMatches]);

  const { updateMatch } = useMatchMutations(user?.id);

  const filteredMatches = useMemo(() => {
    let filtered = matches;
    const now = new Date();

    if (timeFilter === 'upcoming') {
      filtered = filtered.filter((match) => new Date(match.date) > now && (match.status === 'pending' || match.status === 'in_progress'));
    } else if (timeFilter === 'recent') {
      filtered = filtered.filter((match) => new Date(match.date) <= now || match.status === 'completed');
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((match) => match.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const lowercasedQuery = searchQuery.toLowerCase();
      filtered = filtered.filter((match) => 
        match.player1?.username.toLowerCase().includes(lowercasedQuery) ||
        match.player2?.username.toLowerCase().includes(lowercasedQuery) ||
        (match.location && match.location.toLowerCase().includes(lowercasedQuery))
      );
    }

    // Exclude pending matches from the main list, they are shown in the Dashboard
    return filtered.filter((match) => match.status !== 'pending');
  }, [matches, searchQuery, statusFilter, timeFilter]);

  const upcomingMatches = useMemo(() => {
    const now = new Date();
    return matches
      .filter((match) => new Date(match.date) > now && (match.status === 'pending' || match.status === 'in_progress'))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [matches]);

  const handleReportScore = (match: Match) => {
    setSelectedMatch(match);
    setShowScoreModal(true);
  };

  const handleScoreSubmit = async (player1_games: number, player2_games: number) => {
    if (!selectedMatch || !user) return;

    const winnerId = player1_games > player2_games 
      ? selectedMatch.challengerId 
      : selectedMatch.challengedId;

    const scoreObject = {
      sets: [{ player1_games, player2_games, games: [] }],
      current_game: { player1: '0', player2: '0' },
      server_id: selectedMatch.challengerId,
      is_tiebreak: false
    };

    updateMatch.mutate(
      { 
        id: selectedMatch.id, 
        updates: { 
          score: scoreObject as any, // Supabase types are tricky for JSONB
          winner_id: winnerId, 
          status: 'completed' 
        }
      },
      {
        onSuccess: () => {
          setShowScoreModal(false);
          setSelectedMatch(null);
        }
      }
    );
  };

  const handleCreateMatch = () => setShowCreateForm(true);
  const handleViewMatch = (matchId: string) => navigate(`/matches/${matchId}`);

  if (isLoading) {
    return (
      <div className="match-list-page">
        <div className="match-list-container">
          <LoadingSpinner size="large" text="Loading matches..." subtext="Retrieving your match history" />
        </div>
      </div>
    );
  }

  return (
    <div className="match-list-page">
      <div className="match-list-container">
        <header className="matches-header">
          <div>
            <h1 className="matches-title">Matches</h1>
            <p className="matches-subtitle">View your match history, challenge players, and report scores.</p>
          </div>
          <div className="matches-header-actions">
            <button className="btn btn-primary btn-icon" onClick={handleCreateMatch}>
              <Plus size={18} />
              Create Match
            </button>
          </div>
        </header>

        <div className="match-list-controls">
          <div className="search-bar">
            <Search size={20} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search by opponent or location..." 
              className="search-input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <Filter size={18} className="filter-icon" />
            <select 
              className="filter-select"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as Match['status'] | 'all')}
            >
              <option value="all">All Statuses</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select 
              className="filter-select"
              value={timeFilter}
              onChange={e => setTimeFilter(e.target.value as 'all' | 'upcoming' | 'recent')}
            >
              <option value="all">All Time</option>
              <option value="upcoming">Upcoming</option>
              <option value="recent">Recent</option>
            </select>
          </div>
        </div>

        {timeFilter === 'all' && upcomingMatches.length > 0 && (
          <section className="match-section">
            <h2 className="section-title">
              <Clock size={22} className="section-title-icon" />
              Upcoming Matches
            </h2>
            <div className="match-grid">
              {upcomingMatches.map((match) => (
                <MatchCard 
                  key={match.id} 
                  match={match} 
                  currentUserId={user?.id || ''} 
                  onReportScore={() => handleReportScore(match)}
                  onViewDetails={() => handleViewMatch(match.id)}
                />
              ))}
            </div>
          </section>
        )}

        <section className="match-section">
          <h2 className="section-title">
            <Swords size={22} className="section-title-icon" />
            {timeFilter === 'all' ? 'Recent Matches' : 'Filtered Matches'}
          </h2>
          {filteredMatches.length > 0 ? (
            <div className="match-grid">
              {filteredMatches.map((match) => (
                <MatchCard 
                  key={match.id} 
                  match={match} 
                  currentUserId={user?.id || ''} 
                  onReportScore={() => handleReportScore(match)}
                  onViewDetails={() => handleViewMatch(match.id)}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Trophy size={48} className="empty-state-icon" />
              <h3 className="empty-state-title">No Matches Found</h3>
              <p className="empty-state-text">Adjust your filters or create a new match to get started.</p>
            </div>
          )}
        </section>
      </div>

      {showScoreModal && selectedMatch && (
        <ScoreModal
          isOpen={showScoreModal}
          onClose={() => setShowScoreModal(false)}
          onSubmit={handleScoreSubmit}
          match={selectedMatch as Match}
        />
      )}

      {showCreateForm && (
        <CreateMatchModal
          isOpen={showCreateForm}
          onClose={() => setShowCreateForm(false)}
          onMatchCreated={() => setShowCreateForm(false)} // Query invalidation handles the refresh
          mode="create"
        />
      )}
    </div>
  );
};