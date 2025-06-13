import { MatchEvent, DetailedMatchStatistics, MatchTimeline, MatchHighlight } from '../types';
import { UserService } from './UserService';

export class StatisticsService {
  private static EVENTS_KEY = 'tennis-platform-match-events';
  private static STATISTICS_KEY = 'tennis-platform-detailed-statistics';

  // Event Management
  static recordMatchEvent(matchId: string, event: Omit<MatchEvent, 'id' | 'matchId'>): string {
    const fullEvent: MatchEvent = {
      ...event,
      id: this.generateId('event'),
      matchId,
    };

    const events = this.getAllEvents();
    events.push(fullEvent);
    localStorage.setItem(this.EVENTS_KEY, JSON.stringify(events));

    return fullEvent.id;
  }

  static getMatchEvents(matchId: string): MatchEvent[] {
    const events = this.getAllEvents();
    return events.filter(event => event.matchId === matchId);
  }

  static getAllEvents(): MatchEvent[] {
    const stored = localStorage.getItem(this.EVENTS_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  // Statistics Management
  static initializeMatchStatistics(matchId: string, player1Id: string, player2Id: string): string {
    const statsId = this.generateId('stats');
    
    const initialStats: DetailedMatchStatistics = {
      id: statsId,
      matchId,
      player1Id,
      player2Id,
      startTime: Date.now(),
      possession: { player1: 0, player2: 0 },
      shots: { player1: 0, player2: 0 },
      aces: { player1: 0, player2: 0 },
      doubleFaults: { player1: 0, player2: 0 },
      breakPoints: { 
        player1: { won: 0, total: 0 }, 
        player2: { won: 0, total: 0 } 
      },
      winners: { player1: 0, player2: 0 },
      unforcedErrors: { player1: 0, player2: 0 },
      gamesWon: { player1: 0, player2: 0 },
      setsWon: { player1: 0, player2: 0 },
      longestRally: 0,
      totalRallies: 0,
      averageRallyLength: 0,
      timeInPoints: 0,
      timeInBreaks: 0,
      momentumShifts: []
    };

    this.updateDetailedMatchStatistics(statsId, initialStats);
    return statsId;
  }

  static updateDetailedMatchStatistics(statsId: string, stats: DetailedMatchStatistics): void {
    const allStats = this.getAllStatistics();
    const index = allStats.findIndex(s => s.id === statsId);
    
    if (index >= 0) {
      allStats[index] = stats;
    } else {
      allStats.push(stats);
    }
    
    localStorage.setItem(this.STATISTICS_KEY, JSON.stringify(allStats));
  }

  static getDetailedMatchStatistics(statsId: string): DetailedMatchStatistics | null {
    const allStats = this.getAllStatistics();
    return allStats.find(s => s.id === statsId) || null;
  }

  static getDetailedMatchStatisticsByMatchId(matchId: string): DetailedMatchStatistics | null {
    const allStats = this.getAllStatistics();
    return allStats.find(s => s.matchId === matchId) || null;
  }

  static getAllStatistics(): DetailedMatchStatistics[] {
    const stored = localStorage.getItem(this.STATISTICS_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  // Event Processing and Statistics Updates
  static processPointEvent(
    statsId: string, 
    playerId: string, 
    eventType: MatchEvent['type'],
    scoreSnapshot: MatchEvent['scoreSnapshot'],
    metadata?: MatchEvent['metadata']
  ): void {
    const stats = this.getDetailedMatchStatistics(statsId);
    if (!stats) return;

    const isPlayer1 = playerId === stats.player1Id;
    const playerKey = isPlayer1 ? 'player1' : 'player2';

    // Update shot count for every point
    stats.shots[playerKey]++;

    // Update specific statistics based on event type
    switch (eventType) {
      case 'ace':
        stats.aces[playerKey]++;
        break;
      case 'double_fault':
        stats.doubleFaults[playerKey]++;
        break;
      case 'winner':
        stats.winners[playerKey]++;
        break;
      case 'unforced_error':
        stats.unforcedErrors[playerKey]++;
        break;
      case 'break_point':
        if (metadata?.isBreakPoint) {
          stats.breakPoints[playerKey].total++;
          // If this player won the point, they converted/saved the break point
          stats.breakPoints[playerKey].won++;
        }
        break;
      case 'game_won':
        stats.gamesWon[playerKey]++;
        break;
      case 'set_won':
        stats.setsWon[playerKey]++;
        break;
    }

    // Update possession based on who's serving
    const servingPlayer = scoreSnapshot.servingPlayer;
    if (servingPlayer === 'player1') {
      stats.possession.player1 += 1;
    } else {
      stats.possession.player2 += 1;
    }

    // Calculate possession percentages
    const totalPossession = stats.possession.player1 + stats.possession.player2;
    if (totalPossession > 0) {
      stats.possession.player1 = Math.round((stats.possession.player1 / totalPossession) * 100);
      stats.possession.player2 = 100 - stats.possession.player1;
    }

    // Update rally statistics (simplified)
    stats.totalRallies = stats.totalRallies ? stats.totalRallies + 1 : 1;
    const currentRallyLength = Math.floor(Math.random() * 15) + 1; // Mock rally length
    if (!stats.longestRally || currentRallyLength > stats.longestRally) {
      stats.longestRally = currentRallyLength;
    }
    
    if (stats.totalRallies > 0) {
      stats.averageRallyLength = Math.round(
        ((stats.averageRallyLength || 0) * (stats.totalRallies - 1) + currentRallyLength) / stats.totalRallies
      );
    }

    this.updateDetailedMatchStatistics(statsId, stats);
  }

  static finalizeMatchStatistics(statsId: string): void {
    const stats = this.getDetailedMatchStatistics(statsId);
    if (!stats) return;

    stats.endTime = Date.now();
    stats.duration = Math.round((stats.endTime - stats.startTime) / (1000 * 60)); // Duration in minutes

    this.updateDetailedMatchStatistics(statsId, stats);
  }

  // Timeline Generation
  static generateMatchTimeline(matchId: string): MatchTimeline[] {
    const events = this.getMatchEvents(matchId);
    
    return events
      .filter(event => ['ace', 'winner', 'break_point', 'set_won', 'game_won'].includes(event.type))
      .map(event => {
        const eventTime = new Date(event.timestamp);
        const player = UserService.getPlayerById(event.playerId);
        
        return {
          time: eventTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          event: this.getEventDisplayName(event.type),
          player: player?.name || 'Unknown Player',
          description: event.description,
          type: this.mapEventTypeToTimelineType(event.type)
        };
      })
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  // Highlights Generation
  static generateMatchHighlights(matchId: string): MatchHighlight[] {
    const events = this.getMatchEvents(matchId);
    const highlights: MatchHighlight[] = [];

    // Find significant events for highlights
    const aces = events.filter(e => e.type === 'ace');
    const winners = events.filter(e => e.type === 'winner');
    const breakPoints = events.filter(e => e.type === 'break_point');
    const longRallies = events.filter(e => e.metadata?.shotType === 'rally' && Math.random() > 0.7);

    // Create highlights from significant events
    if (aces.length > 0) {
      const bestAce = aces[Math.floor(Math.random() * aces.length)];
      highlights.push({
        id: this.generateId('highlight'),
        title: 'Powerful Service Ace',
        description: `${bestAce.description} - a crucial ace at the perfect moment`,
        timestamp: new Date(bestAce.timestamp).toLocaleTimeString(),
        type: 'ace'
      });
    }

    if (winners.length > 0) {
      const bestWinner = winners[Math.floor(Math.random() * winners.length)];
      highlights.push({
        id: this.generateId('highlight'),
        title: 'Spectacular Winner',
        description: `${bestWinner.description} - an incredible shot to win the point`,
        timestamp: new Date(bestWinner.timestamp).toLocaleTimeString(),
        type: 'winner'
      });
    }

    if (breakPoints.length > 0) {
      const crucialBreak = breakPoints[Math.floor(Math.random() * breakPoints.length)];
      highlights.push({
        id: this.generateId('highlight'),
        title: 'Crucial Break Point',
        description: `${crucialBreak.description} - a momentum-changing moment`,
        timestamp: new Date(crucialBreak.timestamp).toLocaleTimeString(),
        type: 'break_point'
      });
    }

    if (longRallies.length > 0) {
      const amazingRally = longRallies[Math.floor(Math.random() * longRallies.length)];
      highlights.push({
        id: this.generateId('highlight'),
        title: 'Amazing Rally',
        description: `${amazingRally.description} - an incredible exchange of shots`,
        timestamp: new Date(amazingRally.timestamp).toLocaleTimeString(),
        type: 'rally'
      });
    }

    return highlights;
  }

  // Helper Methods
  private static getEventDisplayName(eventType: MatchEvent['type']): string {
    const displayNames: Record<MatchEvent['type'], string> = {
      'point_won': 'Point Won',
      'ace': 'Ace',
      'double_fault': 'Double Fault',
      'winner': 'Winner',
      'unforced_error': 'Unforced Error',
      'break_point': 'Break Point',
      'game_won': 'Game Won',
      'set_won': 'Set Won',
      'match_start': 'Match Start',
      'match_end': 'Match End'
    };
    return displayNames[eventType] || eventType;
  }

  private static mapEventTypeToTimelineType(eventType: MatchEvent['type']): MatchTimeline['type'] {
    const typeMap: Record<MatchEvent['type'], MatchTimeline['type']> = {
      'point_won': 'point',
      'ace': 'ace',
      'double_fault': 'error',
      'winner': 'winner',
      'unforced_error': 'error',
      'break_point': 'break',
      'game_won': 'game',
      'set_won': 'set',
      'match_start': 'game',
      'match_end': 'game'
    };
    return typeMap[eventType] || 'point';
  }

  private static generateId(prefix: string): string {
    return `${prefix}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Mock Data Initialization
  static initializeMockData(): void {
    const existingStats = this.getAllStatistics();
    if (existingStats.length > 0) return;

    // Create mock statistics for existing matches
    const mockStats: DetailedMatchStatistics[] = [
      {
        id: 'stats_mock_1',
        matchId: 'match_recent_1',
        player1Id: 'current_user',
        player2Id: 'mock_2',
        startTime: Date.now() - 3 * 24 * 60 * 60 * 1000,
        endTime: Date.now() - 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000,
        duration: 135,
        possession: { player1: 55, player2: 45 },
        shots: { player1: 89, player2: 76 },
        aces: { player1: 7, player2: 4 },
        doubleFaults: { player1: 2, player2: 3 },
        breakPoints: { 
          player1: { won: 3, total: 5 }, 
          player2: { won: 1, total: 3 } 
        },
        winners: { player1: 23, player2: 18 },
        unforcedErrors: { player1: 12, player2: 15 },
        gamesWon: { player1: 6, player2: 4 },
        setsWon: { player1: 1, player2: 0 },
        longestRally: 28,
        totalRallies: 45,
        averageRallyLength: 8,
        timeInPoints: 3600,
        timeInBreaks: 2400,
        momentumShifts: [
          {
            timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000,
            playerId: 'current_user',
            reason: 'Break point conversion'
          }
        ]
      },
      {
        id: 'stats_mock_2',
        matchId: 'match_recent_2',
        player1Id: 'mock_4',
        player2Id: 'current_user',
        startTime: Date.now() - 7 * 24 * 60 * 60 * 1000,
        endTime: Date.now() - 7 * 24 * 60 * 60 * 1000 + 2.5 * 60 * 60 * 1000,
        duration: 150,
        possession: { player1: 52, player2: 48 },
        shots: { player1: 95, player2: 88 },
        aces: { player1: 8, player2: 5 },
        doubleFaults: { player1: 1, player2: 4 },
        breakPoints: { 
          player1: { won: 2, total: 4 }, 
          player2: { won: 1, total: 2 } 
        },
        winners: { player1: 25, player2: 19 },
        unforcedErrors: { player1: 10, player2: 16 },
        gamesWon: { player1: 7, player2: 5 },
        setsWon: { player1: 1, player2: 0 },
        longestRally: 32,
        totalRallies: 52,
        averageRallyLength: 9,
        timeInPoints: 4200,
        timeInBreaks: 2800,
        momentumShifts: [
          {
            timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000,
            playerId: 'mock_4',
            reason: 'Service break'
          }
        ]
      }
    ];

    localStorage.setItem(this.STATISTICS_KEY, JSON.stringify(mockStats));

    // Create some mock events for these matches
    const mockEvents: MatchEvent[] = [
      {
        id: 'event_1',
        matchId: 'match_recent_1',
        timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000,
        type: 'ace',
        playerId: 'current_user',
        description: 'Service ace down the T',
        scoreSnapshot: {
          player1Sets: [],
          player2Sets: [],
          player1Games: 1,
          player2Games: 0,
          player1Points: 1,
          player2Points: 0,
          currentSet: 1,
          servingPlayer: 'player1'
        }
      },
      {
        id: 'event_2',
        matchId: 'match_recent_1',
        timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000,
        type: 'break_point',
        playerId: 'current_user',
        description: 'Break point converted with forehand winner',
        scoreSnapshot: {
          player1Sets: [],
          player2Sets: [],
          player1Games: 2,
          player2Games: 1,
          player1Points: 0,
          player2Points: 0,
          currentSet: 1,
          servingPlayer: 'player2'
        },
        metadata: {
          isBreakPoint: true
        }
      }
    ];

    localStorage.setItem(this.EVENTS_KEY, JSON.stringify(mockEvents));
  }
}