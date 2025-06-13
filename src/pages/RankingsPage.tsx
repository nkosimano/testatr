import React from 'react';
import { useRankings } from '../hooks/useRankings';
import { Search, Filter, TrendingUp, TrendingDown, Minus, Trophy, Medal, Award, BarChart3 } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const RankingsPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [skillFilter, setSkillFilter] = React.useState<'all' | 'beginner' | 'intermediate' | 'advanced' | 'expert'>('all');
  const [sortBy, setSortBy] = React.useState<'elo_rating' | 'username' | 'matches_played'>('elo_rating');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc');
  
  const { players, isLoading, error } = useRankings();
  
  // Filter and sort players
  const filteredAndSortedPlayers = React.useMemo(() => {
    if (!players) return [];
    
    let filtered = [...players];
    
    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(player =>
        player.username.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply skill level filter
    if (skillFilter !== 'all') {
      filtered = filtered.filter(player => player.skill_level === skillFilter);
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'elo_rating':
          comparison = a.elo_rating - b.elo_rating;
          break;
        case 'username':
          comparison = a.username.localeCompare(b.username);
          break;
        case 'matches_played':
          comparison = a.matches_played - b.matches_played;
          break;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    
    // Add rank property
    return filtered.map((player, index) => ({
      ...player,
      rank: index + 1,
      // Mock rank change for UI demonstration
      rankChange: Math.random() > 0.5 ? 'up' : Math.random() > 0.5 ? 'down' : 'same',
      rankChangeValue: Math.floor(Math.random() * 3) + 1
    }));
  }, [players, searchQuery, skillFilter, sortBy, sortOrder]);
  
  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy size={20} style={{ color: 'var(--accent-yellow)' }} />;
    if (rank === 2) return <Medal size={20} style={{ color: 'var(--text-muted)' }} />;
    if (rank === 3) return <Award size={20} style={{ color: '#cd7f32' }} />;
    return null;
  };
  
  const getRankChangeIcon = (change: string, value: number) => {
    switch (change) {
      case 'up':
        return (
          <div className="rank-change rank-change-up">
            <TrendingUp size={14} />
            <span>{value}</span>
          </div>
        );
      case 'down':
        return (
          <div className="rank-change rank-change-down">
            <TrendingDown size={14} />
            <span>{value}</span>
          </div>
        );
      default:
        return (
          <div className="rank-change rank-change-same">
            <Minus size={14} />
          </div>
        );
    }
  };
  
  const getSkillLevelColor = (skillLevel: string) => {
    switch (skillLevel) {
      case 'beginner':
        return 'var(--rating-beginner)';
      case 'intermediate':
        return 'var(--rating-intermediate)';
      case 'advanced':
        return 'var(--rating-advanced)';
      case 'expert':
        return 'var(--rating-expert)';
      default:
        return 'var(--text-muted)';
    }
  };
  
  if (isLoading) {
    return (
      <div className="rankings-page">
        <div className="rankings-header">
          <div className="rankings-title-section">
            <h1 className="rankings-title">
              <BarChart3 size={32} />
              Ratings & Rankings
            </h1>
            <p className="rankings-subtitle">
              Player leaderboard ranked by skill rating and competitive performance
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="large" text="Loading rankings..." />
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="rankings-page">
        <div className="rankings-header">
          <div className="rankings-title-section">
            <h1 className="rankings-title">
              <BarChart3 size={32} />
              Ratings & Rankings
            </h1>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4 my-4">
          Error loading rankings: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="rankings-page">
      {/* Header */}
      <div className="rankings-header">
        <div className="rankings-title-section">
          <h1 className="rankings-title">
            <BarChart3 size={32} />
            Ratings & Rankings
          </h1>
          <p className="rankings-subtitle">
            Player leaderboard ranked by skill rating and competitive performance
          </p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="rankings-controls">
        <div className="rankings-search">
          <div className="search-container">
            <Search size={20} className="search-icon" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input search-input"
              placeholder="Search players by name..."
            />
          </div>
        </div>

        <div className="rankings-filters">
          <div className="filter-group">
            <label className="filter-label">Skill Level</label>
            <select
              value={skillFilter}
              onChange={(e) => setSkillFilter(e.target.value as typeof skillFilter)}
              className="form-select"
            >
              <option value="all">All Levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="expert">Expert</option>
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="form-select"
            >
              <option value="elo_rating">Rating</option>
              <option value="username">Name</option>
              <option value="matches_played">Matches Played</option>
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Order</label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
              className="form-select"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
        </div>
      </div>

      {/* Rankings Table */}
      <div className="rankings-table-container">
        <div className="rankings-table">
          <div className="rankings-table-header">
            <div className="rank-col">Rank</div>
            <div className="player-col">Player</div>
            <div className="rating-col">Rating</div>
            <div className="matches-col">Matches</div>
            <div className="winrate-col">Win Rate</div>
            <div className="change-col">Change</div>
          </div>

          <div className="rankings-table-body">
            {filteredAndSortedPlayers.map((player) => {
              const winRate = player.matches_played > 0 
                ? ((player.matches_won / player.matches_played) * 100).toFixed(1)
                : '0.0';

              return (
                <div key={player.user_id} className="rankings-table-row">
                  <div className="rank-col">
                    <div className="rank-display">
                      {getRankIcon(player.rank)}
                      <span className="rank-number">#{player.rank}</span>
                    </div>
                  </div>

                  <div className="player-col">
                    <div className="player-info">
                      <div className="player-avatar">
                        {player.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="player-details">
                        <div className="player-name">{player.username}</div>
                        <div 
                          className="player-skill"
                          style={{ color: getSkillLevelColor(player.skill_level) }}
                        >
                          {player.skill_level}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rating-col">
                    <div className="rating-display">
                      <span className="rating-value">{player.elo_rating}</span>
                      <span className="rating-label">Rating</span>
                    </div>
                  </div>

                  <div className="matches-col">
                    <div className="matches-display">
                      <span className="matches-played">{player.matches_played}</span>
                      <span className="matches-won">({player.matches_won}W)</span>
                    </div>
                  </div>

                  <div className="winrate-col">
                    <div className="winrate-display">
                      <span className="winrate-value">{winRate}%</span>
                    </div>
                  </div>

                  <div className="change-col">
                    {getRankChangeIcon(player.rankChange, player.rankChangeValue)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {filteredAndSortedPlayers.length === 0 && (
          <div className="rankings-empty">
            <BarChart3 size={48} style={{ color: 'var(--text-muted)' }} />
            <h3>No players found</h3>
            <p>Try adjusting your search or filter criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RankingsPage;