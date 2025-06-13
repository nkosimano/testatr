import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, TrendingUp, TrendingDown, Minus, Trophy, Medal, Award, BarChart3 } from 'lucide-react';
import { UserService } from '../services/UserService';
import { User } from '../types';

interface PlayerRanking extends User {
  rank: number;
  previousRank?: number;
  rankChange: 'up' | 'down' | 'same' | 'new';
  rankChangeValue: number;
}

const RankingsPage: React.FC = () => {
  const [players, setPlayers] = useState<PlayerRanking[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [skillFilter, setSkillFilter] = useState<'all' | 'Beginner' | 'Intermediate' | 'Advanced'>('all');
  const [sortBy, setSortBy] = useState<'rating' | 'name' | 'matches'>('rating');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadRankings();
  }, []);

  const loadRankings = () => {
    const allPlayers = UserService.getAllPlayers();
    
    // Sort by rating to determine rankings
    const sortedPlayers = allPlayers.sort((a, b) => b.rating - a.rating);
    
    // Add ranking information with mock previous rankings for demo
    const rankedPlayers: PlayerRanking[] = sortedPlayers.map((player, index) => {
      const currentRank = index + 1;
      // Mock previous rank for demonstration (in real app, this would come from historical data)
      const previousRank = currentRank + Math.floor(Math.random() * 6) - 3; // Random change of -3 to +3
      
      let rankChange: PlayerRanking['rankChange'] = 'same';
      let rankChangeValue = 0;
      
      if (previousRank > 0) {
        if (currentRank < previousRank) {
          rankChange = 'up';
          rankChangeValue = previousRank - currentRank;
        } else if (currentRank > previousRank) {
          rankChange = 'down';
          rankChangeValue = currentRank - previousRank;
        }
      } else {
        rankChange = 'new';
      }

      return {
        ...player,
        rank: currentRank,
        previousRank: previousRank > 0 ? previousRank : undefined,
        rankChange,
        rankChangeValue,
      };
    });

    setPlayers(rankedPlayers);
  };

  const filteredAndSortedPlayers = useMemo(() => {
    let filtered = players;

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(player =>
        player.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply skill level filter
    if (skillFilter !== 'all') {
      filtered = filtered.filter(player => player.skillLevel === skillFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'rating':
          comparison = a.rating - b.rating;
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'matches':
          comparison = a.matchesPlayed - b.matchesPlayed;
          break;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [players, searchQuery, skillFilter, sortBy, sortOrder]);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy size={20} style={{ color: 'var(--accent-yellow)' }} />;
    if (rank === 2) return <Medal size={20} style={{ color: 'var(--text-muted)' }} />;
    if (rank === 3) return <Award size={20} style={{ color: '#cd7f32' }} />;
    return null;
  };

  const getRankChangeIcon = (change: PlayerRanking['rankChange'], value: number) => {
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
      case 'new':
        return (
          <div className="rank-change rank-change-new">
            <span>NEW</span>
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
      case 'Beginner':
        return 'var(--rating-beginner)';
      case 'Intermediate':
        return 'var(--rating-intermediate)';
      case 'Advanced':
        return 'var(--rating-advanced)';
      default:
        return 'var(--text-muted)';
    }
  };

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
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="form-select"
            >
              <option value="rating">Rating</option>
              <option value="name">Name</option>
              <option value="matches">Matches Played</option>
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
            {filteredAndSortedPlayers.map((player, index) => {
              const winRate = player.matchesPlayed > 0 
                ? ((player.matchesWon / player.matchesPlayed) * 100).toFixed(1)
                : '0.0';

              return (
                <div key={player.id} className="rankings-table-row">
                  <div className="rank-col">
                    <div className="rank-display">
                      {getRankIcon(player.rank)}
                      <span className="rank-number">#{player.rank}</span>
                    </div>
                  </div>

                  <div className="player-col">
                    <div className="player-info">
                      <div className="player-avatar">
                        {player.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="player-details">
                        <div className="player-name">{player.name}</div>
                        <div 
                          className="player-skill"
                          style={{ color: getSkillLevelColor(player.skillLevel) }}
                        >
                          {player.skillLevel}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rating-col">
                    <div className="rating-display">
                      <span className="rating-value">{player.rating}</span>
                      <span className="rating-label">Rating</span>
                    </div>
                  </div>

                  <div className="matches-col">
                    <div className="matches-display">
                      <span className="matches-played">{player.matchesPlayed}</span>
                      <span className="matches-won">({player.matchesWon}W)</span>
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