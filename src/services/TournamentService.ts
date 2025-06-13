import { Tournament, TournamentParticipant, TournamentMatch, User } from '../types';
import { UserService } from './UserService';

export class TournamentService {
  private static TOURNAMENTS_KEY = 'tennis-platform-tournaments';
  private static PARTICIPANTS_KEY = 'tennis-platform-tournament-participants';
  private static TOURNAMENT_MATCHES_KEY = 'tennis-platform-tournament-matches';

  // Tournament CRUD Operations
  static createTournament(tournamentData: Omit<Tournament, 'id' | 'createdAt' | 'status'>): Tournament {
    const tournament: Tournament = {
      ...tournamentData,
      id: this.generateId('tournament'),
      status: 'registration_open',
      createdAt: new Date().toISOString(),
    };

    const tournaments = this.getAllTournaments();
    tournaments.push(tournament);
    localStorage.setItem(this.TOURNAMENTS_KEY, JSON.stringify(tournaments));

    return tournament;
  }

  static getAllTournaments(): Tournament[] {
    const stored = localStorage.getItem(this.TOURNAMENTS_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  static getTournamentById(id: string): Tournament | null {
    const tournaments = this.getAllTournaments();
    return tournaments.find(t => t.id === id) || null;
  }

  static updateTournament(tournament: Tournament): void {
    const tournaments = this.getAllTournaments();
    const index = tournaments.findIndex(t => t.id === tournament.id);
    if (index >= 0) {
      tournaments[index] = tournament;
      localStorage.setItem(this.TOURNAMENTS_KEY, JSON.stringify(tournaments));
    }
  }

  // Registration Management
  static registerPlayer(tournamentId: string, playerId: string): boolean {
    const tournament = this.getTournamentById(tournamentId);
    if (!tournament || tournament.status !== 'registration_open') {
      return false;
    }

    const participants = this.getTournamentParticipants(tournamentId);
    if (participants.length >= tournament.maxParticipants) {
      return false;
    }

    if (participants.some(p => p.playerId === playerId)) {
      return false; // Already registered
    }

    const participant: TournamentParticipant = {
      id: this.generateId('participant'),
      tournamentId,
      playerId,
      registeredAt: new Date().toISOString(),
    };

    const allParticipants = this.getAllParticipants();
    allParticipants.push(participant);
    localStorage.setItem(this.PARTICIPANTS_KEY, JSON.stringify(allParticipants));

    return true;
  }

  static getTournamentParticipants(tournamentId: string): TournamentParticipant[] {
    const participants = this.getAllParticipants();
    return participants.filter(p => p.tournamentId === tournamentId);
  }

  static getAllParticipants(): TournamentParticipant[] {
    const stored = localStorage.getItem(this.PARTICIPANTS_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  // Bracket Generation
  static generateBracket(tournamentId: string): boolean {
    const tournament = this.getTournamentById(tournamentId);
    if (!tournament || tournament.status !== 'registration_closed') {
      return false;
    }

    const participants = this.getTournamentParticipants(tournamentId);
    if (participants.length < 2) {
      return false;
    }

    // Get actual player objects and seed them based on rating
    const players = participants
      .map(p => UserService.getPlayerById(p.playerId))
      .filter(Boolean) as User[];
    
    players.sort((a, b) => b.rating - a.rating);

    // Update participants with seeding
    const updatedParticipants = this.getAllParticipants();
    players.forEach((player, index) => {
      const participantIndex = updatedParticipants.findIndex(
        p => p.tournamentId === tournamentId && p.playerId === player.id
      );
      if (participantIndex >= 0) {
        updatedParticipants[participantIndex].seed = index + 1;
      }
    });
    localStorage.setItem(this.PARTICIPANTS_KEY, JSON.stringify(updatedParticipants));

    // Clear any existing matches for this tournament
    const allMatches = this.getAllTournamentMatches();
    const filteredMatches = allMatches.filter(m => m.tournamentId !== tournamentId);
    
    // Generate matches based on format
    let newMatches: TournamentMatch[] = [];
    if (tournament.format === 'single_elimination') {
      newMatches = this.generateSingleEliminationBracket(tournament, players);
    } else if (tournament.format === 'double_elimination') {
      newMatches = this.generateDoubleEliminationBracket(tournament, players);
    } else if (tournament.format === 'round_robin') {
      newMatches = this.generateRoundRobinBracket(tournament, players);
    }

    // Save the new matches
    const updatedMatches = [...filteredMatches, ...newMatches];
    localStorage.setItem(this.TOURNAMENT_MATCHES_KEY, JSON.stringify(updatedMatches));

    // Update tournament status
    tournament.status = 'in_progress';
    this.updateTournament(tournament);

    return true;
  }

  private static generateSingleEliminationBracket(tournament: Tournament, players: User[]): TournamentMatch[] {
    const matches: TournamentMatch[] = [];
    
    // Calculate the bracket size (next power of 2)
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(players.length)));
    const totalRounds = Math.ceil(Math.log2(bracketSize));
    
    console.log(`Generating single elimination bracket for ${players.length} players, bracket size: ${bracketSize}, rounds: ${totalRounds}`);

    // Create a seeded bracket array
    const bracket: (User | null)[] = new Array(bracketSize).fill(null);
    
    // Place players in bracket using standard tournament seeding
    for (let i = 0; i < players.length; i++) {
      bracket[i] = players[i];
    }

    // Generate first round matches
    const firstRoundMatches = bracketSize / 2;
    for (let i = 0; i < firstRoundMatches; i++) {
      const player1 = bracket[i * 2];
      const player2 = bracket[i * 2 + 1];

      const match: TournamentMatch = {
        id: this.generateId('match'),
        tournamentId: tournament.id,
        round: 1,
        matchNumber: i + 1,
        player1Id: player1?.id,
        player2Id: player2?.id,
        status: 'pending',
        location: tournament.location,
        umpireId: tournament.umpireId,
      };

      // If one player is missing (bye), automatically advance the other
      if (player1 && !player2) {
        match.winnerId = player1.id;
        match.status = 'completed';
        match.score = 'Bye';
      } else if (!player1 && player2) {
        match.winnerId = player2.id;
        match.status = 'completed';
        match.score = 'Bye';
      }

      matches.push(match);
    }

    // Generate subsequent rounds (empty matches to be filled as tournament progresses)
    for (let round = 2; round <= totalRounds; round++) {
      const matchesInRound = Math.pow(2, totalRounds - round);
      for (let i = 0; i < matchesInRound; i++) {
        const match: TournamentMatch = {
          id: this.generateId('match'),
          tournamentId: tournament.id,
          round,
          matchNumber: i + 1,
          status: 'pending',
          location: tournament.location,
          umpireId: tournament.umpireId,
        };
        matches.push(match);
      }
    }

    console.log(`Generated ${matches.length} matches for single elimination tournament ${tournament.name}`);
    return matches;
  }

  private static generateDoubleEliminationBracket(tournament: Tournament, players: User[]): TournamentMatch[] {
    const matches: TournamentMatch[] = [];
    
    // Calculate the bracket size (next power of 2)
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(players.length)));
    const winnersRounds = Math.ceil(Math.log2(bracketSize));
    const losersRounds = (winnersRounds - 1) * 2;
    
    console.log(`Generating double elimination bracket for ${players.length} players, bracket size: ${bracketSize}`);
    console.log(`Winners bracket rounds: ${winnersRounds}, Losers bracket rounds: ${losersRounds}`);

    // Create a seeded bracket array
    const bracket: (User | null)[] = new Array(bracketSize).fill(null);
    
    // Place players in bracket using standard tournament seeding
    for (let i = 0; i < players.length; i++) {
      bracket[i] = players[i];
    }

    // Generate Winners Bracket - Round 1
    const firstRoundMatches = bracketSize / 2;
    for (let i = 0; i < firstRoundMatches; i++) {
      const player1 = bracket[i * 2];
      const player2 = bracket[i * 2 + 1];

      const match: TournamentMatch = {
        id: this.generateId('match'),
        tournamentId: tournament.id,
        round: 1,
        matchNumber: i + 1,
        player1Id: player1?.id,
        player2Id: player2?.id,
        status: 'pending',
        location: tournament.location,
        umpireId: tournament.umpireId,
      };

      // If one player is missing (bye), automatically advance the other
      if (player1 && !player2) {
        match.winnerId = player1.id;
        match.status = 'completed';
        match.score = 'Bye';
      } else if (!player1 && player2) {
        match.winnerId = player2.id;
        match.status = 'completed';
        match.score = 'Bye';
      }

      matches.push(match);
    }

    // Generate remaining Winners Bracket rounds
    for (let round = 2; round <= winnersRounds; round++) {
      const matchesInRound = Math.pow(2, winnersRounds - round);
      for (let i = 0; i < matchesInRound; i++) {
        const match: TournamentMatch = {
          id: this.generateId('match'),
          tournamentId: tournament.id,
          round,
          matchNumber: i + 1,
          status: 'pending',
          location: tournament.location,
          umpireId: tournament.umpireId,
        };
        matches.push(match);
      }
    }

    // Generate Losers Bracket rounds
    // Losers bracket is more complex as it receives players from winners bracket
    for (let round = winnersRounds + 1; round <= winnersRounds + losersRounds; round++) {
      // Calculate matches in this losers bracket round
      const losersRoundNumber = round - winnersRounds;
      let matchesInRound: number;
      
      if (losersRoundNumber % 2 === 1) {
        // Odd losers rounds: only losers from winners bracket
        matchesInRound = Math.pow(2, winnersRounds - Math.ceil(losersRoundNumber / 2) - 1);
      } else {
        // Even losers rounds: survivors play each other
        matchesInRound = Math.pow(2, winnersRounds - (losersRoundNumber / 2) - 1);
      }

      for (let i = 0; i < matchesInRound; i++) {
        const match: TournamentMatch = {
          id: this.generateId('match'),
          tournamentId: tournament.id,
          round,
          matchNumber: i + 1,
          status: 'pending',
          location: tournament.location,
          umpireId: tournament.umpireId,
        };
        matches.push(match);
      }
    }

    // Generate Grand Final
    const grandFinalRound = winnersRounds + losersRounds + 1;
    const grandFinal: TournamentMatch = {
      id: this.generateId('match'),
      tournamentId: tournament.id,
      round: grandFinalRound,
      matchNumber: 1,
      status: 'pending',
      location: tournament.location,
      umpireId: tournament.umpireId,
    };
    matches.push(grandFinal);

    // Generate potential Grand Final Reset (if losers bracket winner beats winners bracket winner)
    const grandFinalReset: TournamentMatch = {
      id: this.generateId('match'),
      tournamentId: tournament.id,
      round: grandFinalRound + 1,
      matchNumber: 1,
      status: 'pending',
      location: tournament.location,
      umpireId: tournament.umpireId,
    };
    matches.push(grandFinalReset);

    console.log(`Generated ${matches.length} matches for double elimination tournament ${tournament.name}`);
    return matches;
  }

  private static generateRoundRobinBracket(tournament: Tournament, players: User[]): TournamentMatch[] {
    const matches: TournamentMatch[] = [];
    const numPlayers = players.length;
    
    console.log(`Generating Round Robin bracket for ${numPlayers} players`);

    // Calculate total number of matches: n(n-1)/2
    const totalMatches = (numPlayers * (numPlayers - 1)) / 2;
    console.log(`Total matches to generate: ${totalMatches}`);

    let matchNumber = 1;

    // Generate all possible pairings
    for (let i = 0; i < numPlayers; i++) {
      for (let j = i + 1; j < numPlayers; j++) {
        const player1 = players[i];
        const player2 = players[j];

        const match: TournamentMatch = {
          id: this.generateId('match'),
          tournamentId: tournament.id,
          round: 1, // In Round Robin, all matches are considered "Round 1"
          matchNumber: matchNumber++,
          player1Id: player1.id,
          player2Id: player2.id,
          status: 'pending',
          location: tournament.location,
          umpireId: tournament.umpireId,
        };

        matches.push(match);
      }
    }

    console.log(`Generated ${matches.length} Round Robin matches for tournament ${tournament.name}`);
    return matches;
  }

  // Match Management
  static getTournamentMatches(tournamentId: string): TournamentMatch[] {
    const matches = this.getAllTournamentMatches();
    return matches.filter(m => m.tournamentId === tournamentId);
  }

  static getAllTournamentMatches(): TournamentMatch[] {
    const stored = localStorage.getItem(this.TOURNAMENT_MATCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  static reportMatchResult(matchId: string, winnerId: string, score: string): boolean {
    const matches = this.getAllTournamentMatches();
    const matchIndex = matches.findIndex(m => m.id === matchId);
    
    if (matchIndex < 0) return false;

    const match = matches[matchIndex];
    const tournament = this.getTournamentById(match.tournamentId);
    if (!tournament) return false;

    match.winnerId = winnerId;
    match.score = score;
    match.status = 'completed';

    matches[matchIndex] = match;
    localStorage.setItem(this.TOURNAMENT_MATCHES_KEY, JSON.stringify(matches));

    // Advance winner based on tournament format
    if (tournament.format === 'single_elimination') {
      this.advanceWinnerSingleElimination(match);
    } else if (tournament.format === 'double_elimination') {
      this.advanceWinnerDoubleElimination(match);
    }

    // Check if tournament is complete
    this.checkTournamentCompletion(match.tournamentId);

    return true;
  }

  private static advanceWinnerSingleElimination(completedMatch: TournamentMatch): void {
    const tournament = this.getTournamentById(completedMatch.tournamentId);
    if (!tournament) return;

    const allMatches = this.getAllTournamentMatches();
    const tournamentMatches = allMatches.filter(m => m.tournamentId === completedMatch.tournamentId);
    
    // Find next round match
    const nextRound = completedMatch.round + 1;
    const nextMatchNumber = Math.ceil(completedMatch.matchNumber / 2);
    
    const nextMatch = tournamentMatches.find(
      m => m.round === nextRound && m.matchNumber === nextMatchNumber
    );

    if (nextMatch) {
      // Determine which slot to fill (player1 or player2)
      if (completedMatch.matchNumber % 2 === 1) {
        nextMatch.player1Id = completedMatch.winnerId;
      } else {
        nextMatch.player2Id = completedMatch.winnerId;
      }

      const matchIndex = allMatches.findIndex(m => m.id === nextMatch.id);
      if (matchIndex >= 0) {
        allMatches[matchIndex] = nextMatch;
        localStorage.setItem(this.TOURNAMENT_MATCHES_KEY, JSON.stringify(allMatches));
      }
    }
  }

  private static advanceWinnerDoubleElimination(completedMatch: TournamentMatch): void {
    const tournament = this.getTournamentById(completedMatch.tournamentId);
    if (!tournament) return;

    const allMatches = this.getAllTournamentMatches();
    const tournamentMatches = allMatches.filter(m => m.tournamentId === completedMatch.tournamentId);
    
    const winnersRounds = Math.ceil(Math.log2(tournament.maxParticipants));
    const isWinnersBracket = completedMatch.round <= winnersRounds;
    const loserId = completedMatch.player1Id === completedMatch.winnerId ? completedMatch.player2Id : completedMatch.player1Id;

    if (isWinnersBracket) {
      // Winners bracket: advance winner to next winners round, send loser to losers bracket
      
      // Advance winner in winners bracket
      const nextWinnersRound = completedMatch.round + 1;
      if (nextWinnersRound <= winnersRounds) {
        const nextMatchNumber = Math.ceil(completedMatch.matchNumber / 2);
        const nextMatch = tournamentMatches.find(
          m => m.round === nextWinnersRound && m.matchNumber === nextMatchNumber
        );

        if (nextMatch) {
          if (completedMatch.matchNumber % 2 === 1) {
            nextMatch.player1Id = completedMatch.winnerId;
          } else {
            nextMatch.player2Id = completedMatch.winnerId;
          }
        }
      }

      // Send loser to losers bracket (if not first round)
      if (completedMatch.round > 1 && loserId) {
        // Find appropriate losers bracket match
        const losersRound = winnersRounds + (completedMatch.round - 1) * 2;
        const losersMatch = tournamentMatches.find(
          m => m.round === losersRound && !m.player1Id && !m.player2Id
        );

        if (losersMatch) {
          if (!losersMatch.player1Id) {
            losersMatch.player1Id = loserId;
          } else if (!losersMatch.player2Id) {
            losersMatch.player2Id = loserId;
          }
        }
      }
    } else {
      // Losers bracket: advance winner to next losers round
      const nextLosersRound = completedMatch.round + 1;
      const nextMatch = tournamentMatches.find(
        m => m.round === nextLosersRound && (!m.player1Id || !m.player2Id)
      );

      if (nextMatch) {
        if (!nextMatch.player1Id) {
          nextMatch.player1Id = completedMatch.winnerId;
        } else if (!nextMatch.player2Id) {
          nextMatch.player2Id = completedMatch.winnerId;
        }
      }
    }

    // Save updated matches
    localStorage.setItem(this.TOURNAMENT_MATCHES_KEY, JSON.stringify(allMatches));
  }

  private static checkTournamentCompletion(tournamentId: string): void {
    const tournament = this.getTournamentById(tournamentId);
    if (!tournament) return;

    const matches = this.getTournamentMatches(tournamentId);
    
    if (tournament.format === 'single_elimination') {
      // For single elimination, check if final match is completed
      const finalMatch = matches.find(m => m.round === Math.max(...matches.map(m => m.round)));
      
      if (finalMatch && finalMatch.status === 'completed' && finalMatch.winnerId) {
        tournament.status = 'completed';
        tournament.winnerId = finalMatch.winnerId;
        this.updateTournament(tournament);
      }
    } else if (tournament.format === 'double_elimination') {
      // For double elimination, check if grand final is completed
      const maxRound = Math.max(...matches.map(m => m.round));
      const grandFinal = matches.find(m => m.round === maxRound && m.status === 'completed');
      
      if (grandFinal && grandFinal.winnerId) {
        // Check if grand final reset is needed
        const winnersRounds = Math.ceil(Math.log2(tournament.maxParticipants));
        const losersRounds = (winnersRounds - 1) * 2;
        const expectedGrandFinalRound = winnersRounds + losersRounds + 1;
        
        if (grandFinal.round === expectedGrandFinalRound) {
          // First grand final completed
          const winnerFromWinners = this.getWinnersBracketFinalWinner(tournamentId);
          
          if (grandFinal.winnerId === winnerFromWinners) {
            // Winners bracket champion won, tournament over
            tournament.status = 'completed';
            tournament.winnerId = grandFinal.winnerId;
            this.updateTournament(tournament);
          } else {
            // Losers bracket champion won, need grand final reset
            // The reset match should already exist, just needs to be played
          }
        } else if (grandFinal.round === expectedGrandFinalRound + 1) {
          // Grand final reset completed
          tournament.status = 'completed';
          tournament.winnerId = grandFinal.winnerId;
          this.updateTournament(tournament);
        }
      }
    } else if (tournament.format === 'round_robin') {
      // For round robin, check if all matches are completed
      const allMatchesCompleted = matches.every(m => m.status === 'completed');
      
      if (allMatchesCompleted && matches.length > 0) {
        // Determine winner based on wins/points
        const winnerId = this.calculateRoundRobinWinner(tournamentId);
        tournament.status = 'completed';
        tournament.winnerId = winnerId;
        this.updateTournament(tournament);
      }
    }
  }

  private static getWinnersBracketFinalWinner(tournamentId: string): string | undefined {
    const matches = this.getTournamentMatches(tournamentId);
    const tournament = this.getTournamentById(tournamentId);
    if (!tournament) return undefined;

    const winnersRounds = Math.ceil(Math.log2(tournament.maxParticipants));
    const winnersFinal = matches.find(m => m.round === winnersRounds && m.status === 'completed');
    
    return winnersFinal?.winnerId;
  }

  private static calculateRoundRobinWinner(tournamentId: string): string | undefined {
    const matches = this.getTournamentMatches(tournamentId);
    const participants = this.getTournamentParticipants(tournamentId);
    
    // Calculate wins for each player
    const playerStats: { [playerId: string]: { wins: number, matches: number } } = {};
    
    // Initialize stats for all participants
    participants.forEach(p => {
      playerStats[p.playerId] = { wins: 0, matches: 0 };
    });
    
    // Count wins from completed matches
    matches.forEach(match => {
      if (match.status === 'completed' && match.winnerId) {
        if (match.player1Id && playerStats[match.player1Id]) {
          playerStats[match.player1Id].matches++;
          if (match.winnerId === match.player1Id) {
            playerStats[match.player1Id].wins++;
          }
        }
        
        if (match.player2Id && playerStats[match.player2Id]) {
          playerStats[match.player2Id].matches++;
          if (match.winnerId === match.player2Id) {
            playerStats[match.player2Id].wins++;
          }
        }
      }
    });
    
    // Find player with most wins
    let maxWins = -1;
    let winnerId: string | undefined;
    
    Object.entries(playerStats).forEach(([playerId, stats]) => {
      if (stats.wins > maxWins) {
        maxWins = stats.wins;
        winnerId = playerId;
      }
    });
    
    return winnerId;
  }

  // Round Robin specific methods
  static getRoundRobinStandings(tournamentId: string): Array<{
    playerId: string;
    player: User | null;
    wins: number;
    losses: number;
    matchesPlayed: number;
    winPercentage: number;
    position: number;
  }> {
    const matches = this.getTournamentMatches(tournamentId);
    const participants = this.getTournamentParticipants(tournamentId);
    
    // Calculate stats for each player
    const playerStats: { [playerId: string]: { wins: number, losses: number, matchesPlayed: number } } = {};
    
    // Initialize stats
    participants.forEach(p => {
      playerStats[p.playerId] = { wins: 0, losses: 0, matchesPlayed: 0 };
    });
    
    // Count results from completed matches
    matches.forEach(match => {
      if (match.status === 'completed' && match.winnerId && match.player1Id && match.player2Id) {
        const loserId = match.winnerId === match.player1Id ? match.player2Id : match.player1Id;
        
        if (playerStats[match.winnerId]) {
          playerStats[match.winnerId].wins++;
          playerStats[match.winnerId].matchesPlayed++;
        }
        
        if (playerStats[loserId]) {
          playerStats[loserId].losses++;
          playerStats[loserId].matchesPlayed++;
        }
      }
    });
    
    // Create standings array
    const standings = Object.entries(playerStats).map(([playerId, stats]) => ({
      playerId,
      player: UserService.getPlayerById(playerId),
      wins: stats.wins,
      losses: stats.losses,
      matchesPlayed: stats.matchesPlayed,
      winPercentage: stats.matchesPlayed > 0 ? (stats.wins / stats.matchesPlayed) * 100 : 0,
      position: 0 // Will be set after sorting
    }));
    
    // Sort by wins (descending), then by win percentage (descending)
    standings.sort((a, b) => {
      if (a.wins !== b.wins) {
        return b.wins - a.wins;
      }
      return b.winPercentage - a.winPercentage;
    });
    
    // Set positions
    standings.forEach((standing, index) => {
      standing.position = index + 1;
    });
    
    return standings;
  }

  // Utility Methods
  static getPlayerTournaments(playerId: string): Tournament[] {
    const participants = this.getAllParticipants();
    const playerParticipations = participants.filter(p => p.playerId === playerId);
    const tournaments = this.getAllTournaments();
    
    return tournaments.filter(t => 
      playerParticipations.some(p => p.tournamentId === t.id)
    );
  }

  static isPlayerRegistered(tournamentId: string, playerId: string): boolean {
    const participants = this.getTournamentParticipants(tournamentId);
    return participants.some(p => p.playerId === playerId);
  }

  static closeRegistration(tournamentId: string): boolean {
    const tournament = this.getTournamentById(tournamentId);
    if (!tournament || tournament.status !== 'registration_open') {
      return false;
    }

    tournament.status = 'registration_closed';
    this.updateTournament(tournament);
    return true;
  }

  private static generateId(prefix: string): string {
    return `${prefix}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Initialize comprehensive mock data
  static initializeMockData(): void {
    const existingTournaments = this.getAllTournaments();
    if (existingTournaments.length > 0) return;

    // Create dates for realistic tournament scheduling
    const now = new Date();
    
    // Tournament 1: Registration Open - Starting Soon
    const tournament1RegDeadline = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days from now
    const tournament1Start = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 1 week from now
    const tournament1End = new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000); // 9 days from now

    // Tournament 2: Registration Closing Soon
    const tournament2RegDeadline = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000); // 1 day from now
    const tournament2Start = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days from now
    const tournament2End = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    // Tournament 3: Ready to Start (Registration Closed) - Round Robin
    const tournament3RegDeadline = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
    const tournament3Start = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000); // Tomorrow
    const tournament3End = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days from now

    // Tournament 4: Currently In Progress
    const tournament4RegDeadline = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
    const tournament4Start = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    const tournament4End = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days from now

    // Tournament 5: Recently Completed - Round Robin
    const tournament5RegDeadline = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
    const tournament5Start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    const tournament5End = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago

    // Tournament 6: Large Tournament - Registration Open
    const tournament6RegDeadline = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 2 weeks from now
    const tournament6Start = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000); // 3 weeks from now
    const tournament6End = new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000); // 25 days from now

    // Tournament 7: Round Robin Open Registration
    const tournament7RegDeadline = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days from now
    const tournament7Start = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 2 weeks from now
    const tournament7End = new Date(now.getTime() + 16 * 24 * 60 * 60 * 1000); // 16 days from now

    // Tournament 8: Double Elimination - Registration Open
    const tournament8RegDeadline = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000); // 8 days from now
    const tournament8Start = new Date(now.getTime() + 12 * 24 * 60 * 60 * 1000); // 12 days from now
    const tournament8End = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 days from now

    // Tournament 9: Double Elimination - Ready to Start
    const tournament9RegDeadline = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    const tournament9Start = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000); // Tomorrow
    const tournament9End = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000); // 4 days from now

    const mockTournaments: Tournament[] = [
      {
        id: 'tournament_1',
        name: 'Midrand Open 2025',
        description: 'The premier tennis tournament in the Midrand area. Join us for an exciting weekend of competitive tennis featuring players from all skill levels. Prize money and trophies for winners!',
        organizerId: 'mock_1',
        registrationDeadline: tournament1RegDeadline.toISOString(),
        startDate: tournament1Start.toISOString(),
        endDate: tournament1End.toISOString(),
        format: 'single_elimination',
        location: 'Midrand Tennis Club, 123 Tennis Avenue, Midrand',
        maxParticipants: 16,
        umpireId: 'mock_2',
        status: 'registration_open',
        createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'tournament_2',
        name: 'Summer Classic Championship',
        description: 'Fast-paced summer tournament for intermediate and advanced players. Experience the thrill of competitive tennis in our state-of-the-art facilities with professional umpiring.',
        organizerId: 'mock_4',
        registrationDeadline: tournament2RegDeadline.toISOString(),
        startDate: tournament2Start.toISOString(),
        endDate: tournament2End.toISOString(),
        format: 'single_elimination',
        location: 'Central Sports Complex, Johannesburg',
        maxParticipants: 32,
        umpireId: 'mock_1',
        status: 'registration_open',
        createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'tournament_3',
        name: 'Round Robin Showcase',
        description: 'Perfect tournament for players who want to play multiple matches! Everyone plays everyone in this comprehensive round robin format. Great for skill development and fair competition.',
        organizerId: 'mock_2',
        registrationDeadline: tournament3RegDeadline.toISOString(),
        startDate: tournament3Start.toISOString(),
        endDate: tournament3End.toISOString(),
        format: 'round_robin',
        location: 'Community Tennis Courts, Sandton',
        maxParticipants: 8,
        umpireId: 'mock_4',
        status: 'registration_closed',
        createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'tournament_4',
        name: 'Elite Masters Cup',
        description: 'High-level tournament for advanced players only. Featuring the best talent in the region with professional-grade facilities and live scoring.',
        organizerId: 'mock_1',
        registrationDeadline: tournament4RegDeadline.toISOString(),
        startDate: tournament4Start.toISOString(),
        endDate: tournament4End.toISOString(),
        format: 'single_elimination',
        location: 'Elite Tennis Academy, Pretoria',
        maxParticipants: 16,
        umpireId: 'mock_2',
        status: 'in_progress',
        createdAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'tournament_5',
        name: 'Spring Round Robin Classic',
        description: 'Completed round robin tournament that showcased amazing talent. Every player got to compete against all others, creating fair and comprehensive competition.',
        organizerId: 'mock_4',
        registrationDeadline: tournament5RegDeadline.toISOString(),
        startDate: tournament5Start.toISOString(),
        endDate: tournament5End.toISOString(),
        format: 'round_robin',
        location: 'Spring Valley Tennis Club',
        maxParticipants: 6,
        umpireId: 'mock_1',
        status: 'completed',
        winnerId: 'mock_1', // Alex Quantum won
        createdAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'tournament_6',
        name: 'Grand Slam Qualifier',
        description: 'Major tournament with 64 players competing for the ultimate prize. This is your chance to prove yourself against the best players in the region. Professional umpiring and live streaming available.',
        organizerId: 'mock_2',
        registrationDeadline: tournament6RegDeadline.toISOString(),
        startDate: tournament6Start.toISOString(),
        endDate: tournament6End.toISOString(),
        format: 'single_elimination',
        location: 'Grand Tennis Arena, Johannesburg',
        maxParticipants: 64,
        umpireId: 'mock_4',
        status: 'registration_open',
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'tournament_7',
        name: 'All-Play-All Championship',
        description: 'Experience the fairest format in tennis! Round Robin ensures every player gets maximum court time and the chance to play against all opponents. Perfect for skill development and networking.',
        organizerId: 'mock_3',
        registrationDeadline: tournament7RegDeadline.toISOString(),
        startDate: tournament7Start.toISOString(),
        endDate: tournament7End.toISOString(),
        format: 'round_robin',
        location: 'Johannesburg Tennis Center',
        maxParticipants: 10,
        umpireId: 'mock_2',
        status: 'registration_open',
        createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'tournament_8',
        name: 'Double Elimination Championship',
        description: 'Experience the most forgiving tournament format! Players get a second chance with our double elimination system. Featuring winners and losers brackets for maximum competitive play.',
        organizerId: 'mock_1',
        registrationDeadline: tournament8RegDeadline.toISOString(),
        startDate: tournament8Start.toISOString(),
        endDate: tournament8End.toISOString(),
        format: 'double_elimination',
        location: 'Premier Tennis Complex, Sandton',
        maxParticipants: 16,
        umpireId: 'mock_3',
        status: 'registration_open',
        createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'tournament_9',
        name: 'Second Chance Showdown',
        description: 'Double elimination tournament ready to begin! Players must lose twice to be eliminated, providing exciting comeback opportunities and ensuring the best player wins.',
        organizerId: 'mock_2',
        registrationDeadline: tournament9RegDeadline.toISOString(),
        startDate: tournament9Start.toISOString(),
        endDate: tournament9End.toISOString(),
        format: 'double_elimination',
        location: 'Elite Sports Arena, Pretoria',
        maxParticipants: 8,
        umpireId: 'mock_1',
        status: 'registration_closed',
        createdAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      }
    ];

    localStorage.setItem(this.TOURNAMENTS_KEY, JSON.stringify(mockTournaments));

    // Create mock participants for tournaments
    const mockParticipants: TournamentParticipant[] = [
      // Tournament 1 participants (Midrand Open) - 12/16 spots filled
      { id: 'part_1_1', tournamentId: 'tournament_1', playerId: 'mock_1', registeredAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(), seed: 1 },
      { id: 'part_1_2', tournamentId: 'tournament_1', playerId: 'mock_2', registeredAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), seed: 2 },
      { id: 'part_1_3', tournamentId: 'tournament_1', playerId: 'mock_3', registeredAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(), seed: 3 },
      { id: 'part_1_4', tournamentId: 'tournament_1', playerId: 'mock_4', registeredAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(), seed: 4 },
      { id: 'part_1_5', tournamentId: 'tournament_1', playerId: 'mock_5', registeredAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(), seed: 5 },
      { id: 'part_1_6', tournamentId: 'tournament_1', playerId: 'mock_6', registeredAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(), seed: 6 },
      { id: 'part_1_7', tournamentId: 'tournament_1', playerId: 'mock_7', registeredAt: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(), seed: 7 },
      { id: 'part_1_8', tournamentId: 'tournament_1', playerId: 'mock_8', registeredAt: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(), seed: 8 },
      { id: 'part_1_9', tournamentId: 'tournament_1', playerId: 'mock_9', registeredAt: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(), seed: 9 },
      { id: 'part_1_10', tournamentId: 'tournament_1', playerId: 'mock_10', registeredAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), seed: 10 },
      { id: 'part_1_11', tournamentId: 'tournament_1', playerId: 'mock_11', registeredAt: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(), seed: 11 },
      { id: 'part_1_12', tournamentId: 'tournament_1', playerId: 'mock_12', registeredAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(), seed: 12 },

      // Tournament 2 participants (Summer Classic) - 28/32 spots filled
      { id: 'part_2_1', tournamentId: 'tournament_2', playerId: 'mock_1', registeredAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'part_2_2', tournamentId: 'tournament_2', playerId: 'mock_4', registeredAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'part_2_3', tournamentId: 'tournament_2', playerId: 'mock_2', registeredAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'part_2_4', tournamentId: 'tournament_2', playerId: 'mock_5', registeredAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString() },
      // Add more participants for tournament 2...
      ...Array.from({ length: 24 }, (_, i) => ({
        id: `part_2_${i + 5}`,
        tournamentId: 'tournament_2',
        playerId: `mock_${(i % 12) + 1}`,
        registeredAt: new Date(now.getTime() - (3 - i * 0.1) * 24 * 60 * 60 * 1000).toISOString()
      })),

      // Tournament 3 participants (Round Robin Showcase) - Full 8/8
      { id: 'part_3_1', tournamentId: 'tournament_3', playerId: 'mock_3', registeredAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(), seed: 1 },
      { id: 'part_3_2', tournamentId: 'tournament_3', playerId: 'mock_6', registeredAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(), seed: 2 },
      { id: 'part_3_3', tournamentId: 'tournament_3', playerId: 'mock_7', registeredAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), seed: 3 },
      { id: 'part_3_4', tournamentId: 'tournament_3', playerId: 'mock_8', registeredAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), seed: 4 },
      { id: 'part_3_5', tournamentId: 'tournament_3', playerId: 'mock_9', registeredAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(), seed: 5 },
      { id: 'part_3_6', tournamentId: 'tournament_3', playerId: 'mock_10', registeredAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(), seed: 6 },
      { id: 'part_3_7', tournamentId: 'tournament_3', playerId: 'mock_11', registeredAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), seed: 7 },
      { id: 'part_3_8', tournamentId: 'tournament_3', playerId: 'mock_12', registeredAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), seed: 8 },

      // Tournament 4 participants (Elite Masters) - Full 16/16 with bracket generated
      ...Array.from({ length: 16 }, (_, i) => ({
        id: `part_4_${i + 1}`,
        tournamentId: 'tournament_4',
        playerId: `mock_${(i % 12) + 1}`,
        registeredAt: new Date(now.getTime() - (12 - i * 0.5) * 24 * 60 * 60 * 1000).toISOString(),
        seed: i + 1
      })),

      // Tournament 5 participants (Completed Round Robin) - 6/6
      { id: 'part_5_1', tournamentId: 'tournament_5', playerId: 'mock_1', registeredAt: new Date(now.getTime() - 18 * 24 * 60 * 60 * 1000).toISOString(), seed: 1 },
      { id: 'part_5_2', tournamentId: 'tournament_5', playerId: 'mock_2', registeredAt: new Date(now.getTime() - 17 * 24 * 60 * 60 * 1000).toISOString(), seed: 2 },
      { id: 'part_5_3', tournamentId: 'tournament_5', playerId: 'mock_4', registeredAt: new Date(now.getTime() - 16 * 24 * 60 * 60 * 1000).toISOString(), seed: 3 },
      { id: 'part_5_4', tournamentId: 'tournament_5', playerId: 'mock_6', registeredAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(), seed: 4 },
      { id: 'part_5_5', tournamentId: 'tournament_5', playerId: 'mock_8', registeredAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(), seed: 5 },
      { id: 'part_5_6', tournamentId: 'tournament_5', playerId: 'mock_10', registeredAt: new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000).toISOString(), seed: 6 },

      // Tournament 6 participants (Grand Slam Qualifier) - 45/64 spots filled
      ...Array.from({ length: 45 }, (_, i) => ({
        id: `part_6_${i + 1}`,
        tournamentId: 'tournament_6',
        playerId: `mock_${(i % 12) + 1}`,
        registeredAt: new Date(now.getTime() - (2 - i * 0.05) * 24 * 60 * 60 * 1000).toISOString()
      })),

      // Tournament 7 participants (Round Robin Open) - 6/10 spots filled
      { id: 'part_7_1', tournamentId: 'tournament_7', playerId: 'mock_2', registeredAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'part_7_2', tournamentId: 'tournament_7', playerId: 'mock_5', registeredAt: new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString() },
      { id: 'part_7_3', tournamentId: 'tournament_7', playerId: 'mock_7', registeredAt: new Date(now.getTime() - 18 * 60 * 60 * 1000).toISOString() },
      { id: 'part_7_4', tournamentId: 'tournament_7', playerId: 'mock_9', registeredAt: new Date(now.getTime() - 15 * 60 * 60 * 1000).toISOString() },
      { id: 'part_7_5', tournamentId: 'tournament_7', playerId: 'mock_11', registeredAt: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString() },
      { id: 'part_7_6', tournamentId: 'tournament_7', playerId: 'mock_12', registeredAt: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString() },

      // Tournament 8 participants (Double Elimination Championship) - 10/16 spots filled
      { id: 'part_8_1', tournamentId: 'tournament_8', playerId: 'mock_1', registeredAt: new Date(now.getTime() - 1.5 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'part_8_2', tournamentId: 'tournament_8', playerId: 'mock_3', registeredAt: new Date(now.getTime() - 1.4 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'part_8_3', tournamentId: 'tournament_8', playerId: 'mock_4', registeredAt: new Date(now.getTime() - 1.3 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'part_8_4', tournamentId: 'tournament_8', playerId: 'mock_6', registeredAt: new Date(now.getTime() - 1.2 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'part_8_5', tournamentId: 'tournament_8', playerId: 'mock_7', registeredAt: new Date(now.getTime() - 1.1 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'part_8_6', tournamentId: 'tournament_8', playerId: 'mock_8', registeredAt: new Date(now.getTime() - 1.0 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'part_8_7', tournamentId: 'tournament_8', playerId: 'mock_9', registeredAt: new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString() },
      { id: 'part_8_8', tournamentId: 'tournament_8', playerId: 'mock_10', registeredAt: new Date(now.getTime() - 18 * 60 * 60 * 1000).toISOString() },
      { id: 'part_8_9', tournamentId: 'tournament_8', playerId: 'mock_11', registeredAt: new Date(now.getTime() - 16 * 60 * 60 * 1000).toISOString() },
      { id: 'part_8_10', tournamentId: 'tournament_8', playerId: 'mock_12', registeredAt: new Date(now.getTime() - 14 * 60 * 60 * 1000).toISOString() },

      // Tournament 9 participants (Second Chance Showdown) - Full 8/8
      { id: 'part_9_1', tournamentId: 'tournament_9', playerId: 'mock_1', registeredAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(), seed: 1 },
      { id: 'part_9_2', tournamentId: 'tournament_9', playerId: 'mock_2', registeredAt: new Date(now.getTime() - 5.5 * 24 * 60 * 60 * 1000).toISOString(), seed: 2 },
      { id: 'part_9_3', tournamentId: 'tournament_9', playerId: 'mock_4', registeredAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), seed: 3 },
      { id: 'part_9_4', tournamentId: 'tournament_9', playerId: 'mock_6', registeredAt: new Date(now.getTime() - 4.5 * 24 * 60 * 60 * 1000).toISOString(), seed: 4 },
      { id: 'part_9_5', tournamentId: 'tournament_9', playerId: 'mock_7', registeredAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(), seed: 5 },
      { id: 'part_9_6', tournamentId: 'tournament_9', playerId: 'mock_8', registeredAt: new Date(now.getTime() - 3.5 * 24 * 60 * 60 * 1000).toISOString(), seed: 6 },
      { id: 'part_9_7', tournamentId: 'tournament_9', playerId: 'mock_9', registeredAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(), seed: 7 },
      { id: 'part_9_8', tournamentId: 'tournament_9', playerId: 'mock_10', registeredAt: new Date(now.getTime() - 2.5 * 24 * 60 * 60 * 1000).toISOString(), seed: 8 }
    ];

    localStorage.setItem(this.PARTICIPANTS_KEY, JSON.stringify(mockParticipants));

    // Create mock matches for in-progress and completed tournaments
    const mockMatches: TournamentMatch[] = [
      // Tournament 4 (Elite Masters) - In Progress with some completed matches
      // Round 1 matches (8 matches)
      {
        id: 'match_4_1_1',
        tournamentId: 'tournament_4',
        round: 1,
        matchNumber: 1,
        player1Id: 'mock_1',
        player2Id: 'mock_8',
        winnerId: 'mock_1',
        score: '6-2, 6-4',
        status: 'completed',
        location: 'Elite Tennis Academy, Pretoria',
        umpireId: 'mock_2',
        scheduledDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'match_4_1_2',
        tournamentId: 'tournament_4',
        round: 1,
        matchNumber: 2,
        player1Id: 'mock_4',
        player2Id: 'mock_5',
        winnerId: 'mock_4',
        score: '7-5, 6-3',
        status: 'completed',
        location: 'Elite Tennis Academy, Pretoria',
        umpireId: 'mock_2',
        scheduledDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'match_4_1_3',
        tournamentId: 'tournament_4',
        round: 1,
        matchNumber: 3,
        player1Id: 'mock_2',
        player2Id: 'mock_7',
        winnerId: 'mock_2',
        score: '6-4, 7-6',
        status: 'completed',
        location: 'Elite Tennis Academy, Pretoria',
        umpireId: 'mock_2',
        scheduledDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'match_4_1_4',
        tournamentId: 'tournament_4',
        round: 1,
        matchNumber: 4,
        player1Id: 'mock_3',
        player2Id: 'mock_6',
        status: 'in_progress',
        location: 'Elite Tennis Academy, Pretoria',
        umpireId: 'mock_2',
        scheduledDate: new Date().toISOString()
      },
      // Remaining Round 1 matches
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `match_4_1_${i + 5}`,
        tournamentId: 'tournament_4',
        round: 1,
        matchNumber: i + 5,
        player1Id: `mock_${(i * 2) + 9}`,
        player2Id: `mock_${(i * 2) + 10}`,
        status: 'pending' as const,
        location: 'Elite Tennis Academy, Pretoria',
        umpireId: 'mock_2',
        scheduledDate: new Date(now.getTime() + (i + 1) * 2 * 60 * 60 * 1000).toISOString()
      })),

      // Round 2 matches (4 matches) - Some with winners advanced
      {
        id: 'match_4_2_1',
        tournamentId: 'tournament_4',
        round: 2,
        matchNumber: 1,
        player1Id: 'mock_1', // Winner from match 1
        player2Id: 'mock_4', // Winner from match 2
        status: 'pending',
        location: 'Elite Tennis Academy, Pretoria',
        umpireId: 'mock_2'
      },
      {
        id: 'match_4_2_2',
        tournamentId: 'tournament_4',
        round: 2,
        matchNumber: 2,
        player1Id: 'mock_2', // Winner from match 3
        player2Id: undefined, // Waiting for match 4 winner
        status: 'pending',
        location: 'Elite Tennis Academy, Pretoria',
        umpireId: 'mock_2'
      },
      // Remaining Round 2 matches
      ...Array.from({ length: 2 }, (_, i) => ({
        id: `match_4_2_${i + 3}`,
        tournamentId: 'tournament_4',
        round: 2,
        matchNumber: i + 3,
        status: 'pending' as const,
        location: 'Elite Tennis Academy, Pretoria',
        umpireId: 'mock_2'
      })),

      // Round 3 (Semi-finals) and Round 4 (Final) - Empty, waiting for previous rounds
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `match_4_${i + 3}_1`,
        tournamentId: 'tournament_4',
        round: i + 3,
        matchNumber: 1,
        status: 'pending' as const,
        location: 'Elite Tennis Academy, Pretoria',
        umpireId: 'mock_2'
      })),

      // Tournament 5 (Completed Round Robin) - All 15 matches completed (6 players = 15 matches)
      // Round Robin matches for 6 players: mock_1, mock_2, mock_4, mock_6, mock_8, mock_10
      {
        id: 'match_5_rr_1',
        tournamentId: 'tournament_5',
        round: 1,
        matchNumber: 1,
        player1Id: 'mock_1',
        player2Id: 'mock_2',
        winnerId: 'mock_1',
        score: '6-4, 6-2',
        status: 'completed',
        location: 'Spring Valley Tennis Club',
        umpireId: 'mock_1',
        scheduledDate: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'match_5_rr_2',
        tournamentId: 'tournament_5',
        round: 1,
        matchNumber: 2,
        player1Id: 'mock_1',
        player2Id: 'mock_4',
        winnerId: 'mock_1',
        score: '7-5, 6-3',
        status: 'completed',
        location: 'Spring Valley Tennis Club',
        umpireId: 'mock_1',
        scheduledDate: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'match_5_rr_3',
        tournamentId: 'tournament_5',
        round: 1,
        matchNumber: 3,
        player1Id: 'mock_1',
        player2Id: 'mock_6',
        winnerId: 'mock_1',
        score: '6-1, 6-4',
        status: 'completed',
        location: 'Spring Valley Tennis Club',
        umpireId: 'mock_1',
        scheduledDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'match_5_rr_4',
        tournamentId: 'tournament_5',
        round: 1,
        matchNumber: 4,
        player1Id: 'mock_1',
        player2Id: 'mock_8',
        winnerId: 'mock_1',
        score: '6-3, 7-5',
        status: 'completed',
        location: 'Spring Valley Tennis Club',
        umpireId: 'mock_1',
        scheduledDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'match_5_rr_5',
        tournamentId: 'tournament_5',
        round: 1,
        matchNumber: 5,
        player1Id: 'mock_1',
        player2Id: 'mock_10',
        winnerId: 'mock_1',
        score: '6-2, 6-1',
        status: 'completed',
        location: 'Spring Valley Tennis Club',
        umpireId: 'mock_1',
        scheduledDate: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString()
      },
      // More Round Robin matches...
      {
        id: 'match_5_rr_6',
        tournamentId: 'tournament_5',
        round: 1,
        matchNumber: 6,
        player1Id: 'mock_2',
        player2Id: 'mock_4',
        winnerId: 'mock_2',
        score: '6-4, 3-6, 6-4',
        status: 'completed',
        location: 'Spring Valley Tennis Club',
        umpireId: 'mock_1',
        scheduledDate: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'match_5_rr_7',
        tournamentId: 'tournament_5',
        round: 1,
        matchNumber: 7,
        player1Id: 'mock_2',
        player2Id: 'mock_6',
        winnerId: 'mock_2',
        score: '7-6, 6-4',
        status: 'completed',
        location: 'Spring Valley Tennis Club',
        umpireId: 'mock_1',
        scheduledDate: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString()
      },
      // Continue with remaining matches to complete the round robin...
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `match_5_rr_${i + 8}`,
        tournamentId: 'tournament_5',
        round: 1,
        matchNumber: i + 8,
        player1Id: i < 4 ? 'mock_2' : i < 6 ? 'mock_4' : i < 7 ? 'mock_6' : 'mock_8',
        player2Id: i < 2 ? 'mock_8' : i < 4 ? 'mock_10' : i < 5 ? 'mock_6' : i < 6 ? 'mock_8' : i < 7 ? 'mock_8' : 'mock_10',
        winnerId: i % 2 === 0 ? (i < 4 ? 'mock_2' : i < 6 ? 'mock_4' : i < 7 ? 'mock_6' : 'mock_8') : (i < 2 ? 'mock_8' : i < 4 ? 'mock_10' : i < 5 ? 'mock_6' : i < 6 ? 'mock_8' : i < 7 ? 'mock_8' : 'mock_10'),
        score: '6-4, 6-3',
        status: 'completed' as const,
        location: 'Spring Valley Tennis Club',
        umpireId: 'mock_1',
        scheduledDate: new Date(now.getTime() - (4 - i * 0.2) * 24 * 60 * 60 * 1000).toISOString()
      }))
    ];

    localStorage.setItem(this.TOURNAMENT_MATCHES_KEY, JSON.stringify(mockMatches));
  }
}