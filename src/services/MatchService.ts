import { Match, User } from '../types';
import { UserService } from './UserService';
import { StatisticsService } from './StatisticsService';

export class MatchService {
  private static STORAGE_KEY = 'tennis-platform-matches';

  static createMatch(playerId: string, opponentId: string, date: string, location: string): Match {
    const match: Match = {
      id: this.generateId(),
      challengerId: playerId,
      challengedId: opponentId,
      date,
      location,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const matches = this.getAllMatches();
    matches.push(match);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(matches));

    return match;
  }

  static reportScore(matchId: string, challengerScore: number, challengedScore: number): void {
    const matches = this.getAllMatches();
    const matchIndex = matches.findIndex(m => m.id === matchId);
    
    if (matchIndex >= 0) {
      const match = matches[matchIndex];
      match.challengerScore = challengerScore;
      match.challengedScore = challengedScore;
      match.status = 'completed';
      match.winner = challengerScore > challengedScore ? match.challengerId : match.challengedId;
      
      // Initialize detailed statistics if not already present
      if (!match.detailedStatsId) {
        match.detailedStatsId = StatisticsService.initializeMatchStatistics(
          matchId,
          match.challengerId,
          match.challengedId
        );
      }
      
      matches[matchIndex] = match;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(matches));

      // Update player ratings
      this.updatePlayerRatings(match);
    }
  }

  static getUserMatches(userId: string): Match[] {
    const matches = this.getAllMatches();
    return matches.filter(match => 
      match.challengerId === userId || match.challengedId === userId
    );
  }

  private static updatePlayerRatings(match: Match): void {
    const challenger = UserService.getPlayerById(match.challengerId);
    const challenged = UserService.getPlayerById(match.challengedId);
    
    if (!challenger || !challenged) return;

    const isWinner = (playerId: string) => match.winner === playerId;
    const K = 32; // K-factor for Elo rating

    const expectedScoreChallenger = 1 / (1 + Math.pow(10, (challenged.rating - challenger.rating) / 400));
    const expectedScoreChallenged = 1 - expectedScoreChallenger;

    const actualScoreChallenger = isWinner(challenger.id) ? 1 : 0;
    const actualScoreChallenged = isWinner(challenged.id) ? 1 : 0;

    const newRatingChallenger = Math.round(challenger.rating + K * (actualScoreChallenger - expectedScoreChallenger));
    const newRatingChallenged = Math.round(challenged.rating + K * (actualScoreChallenged - expectedScoreChallenged));

    // Update challenger
    const updatedChallenger: User = {
      ...challenger,
      rating: newRatingChallenger,
      matchesPlayed: challenger.matchesPlayed + 1,
      matchesWon: challenger.matchesWon + (isWinner(challenger.id) ? 1 : 0),
    };

    // Update challenged
    const updatedChallenged: User = {
      ...challenged,
      rating: newRatingChallenged,
      matchesPlayed: challenged.matchesPlayed + 1,
      matchesWon: challenged.matchesWon + (isWinner(challenged.id) ? 1 : 0),
    };

    UserService.updateUser(updatedChallenger);
    UserService.updateUser(updatedChallenged);
  }

  private static getAllMatches(): Match[] {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  private static generateId(): string {
    return 'match_' + Math.random().toString(36).substr(2, 9);
  }

  // Initialize mock data for realistic dashboard experience
  static initializeMockData(): void {
    const existingMatches = this.getAllMatches();
    if (existingMatches.length > 0) return;

    const now = new Date();
    
    // Create realistic mock matches for the current user and other players
    const mockMatches: Match[] = [
      // Upcoming matches for current user (if they exist)
      {
        id: 'match_upcoming_1',
        challengerId: 'current_user', // This will be replaced with actual user ID
        challengedId: 'mock_3',
        date: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
        location: 'Midrand Tennis Club',
        status: 'confirmed',
        createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'match_upcoming_2',
        challengerId: 'mock_6',
        challengedId: 'current_user',
        date: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
        location: 'Central Sports Complex',
        status: 'pending',
        createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'match_upcoming_3',
        challengerId: 'current_user',
        challengedId: 'mock_8',
        date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week from now
        location: 'Community Tennis Courts',
        status: 'confirmed',
        createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
      },

      // Recent completed matches
      {
        id: 'match_recent_1',
        challengerId: 'current_user',
        challengedId: 'mock_2',
        date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        location: 'Elite Tennis Academy',
        status: 'completed',
        challengerScore: 6,
        challengedScore: 4,
        winner: 'current_user',
        createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        detailedStatsId: 'stats_mock_1', // Link to detailed statistics
      },
      {
        id: 'match_recent_2',
        challengerId: 'mock_4',
        challengedId: 'current_user',
        date: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week ago
        location: 'Spring Valley Tennis Club',
        status: 'completed',
        challengerScore: 7,
        challengedScore: 5,
        winner: 'mock_4',
        createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        detailedStatsId: 'stats_mock_2', // Link to detailed statistics
      },
      {
        id: 'match_recent_3',
        challengerId: 'current_user',
        challengedId: 'mock_7',
        date: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
        location: 'Sandton Tennis Courts',
        status: 'completed',
        challengerScore: 6,
        challengedScore: 3,
        winner: 'current_user',
        createdAt: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000).toISOString(),
      },

      // Matches between other players (for realistic data)
      {
        id: 'match_others_1',
        challengerId: 'mock_1',
        challengedId: 'mock_2',
        date: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'Elite Tennis Academy',
        status: 'completed',
        challengerScore: 6,
        challengedScore: 4,
        winner: 'mock_1',
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'match_others_2',
        challengerId: 'mock_3',
        challengedId: 'mock_5',
        date: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'Community Tennis Courts',
        status: 'confirmed',
        createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      }
    ];

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(mockMatches));
  }

  // Helper method to update mock matches with actual user ID
  static updateMockMatchesWithUserId(userId: string): void {
    const matches = this.getAllMatches();
    const updatedMatches = matches.map(match => {
      if (match.challengerId === 'current_user') {
        return { ...match, challengerId: userId };
      }
      if (match.challengedId === 'current_user') {
        return { ...match, challengedId: userId };
      }
      if (match.winner === 'current_user') {
        return { ...match, winner: userId };
      }
      return match;
    });

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedMatches));
  }
}