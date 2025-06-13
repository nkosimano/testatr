import { User } from '../types';

export class UserService {
  private static STORAGE_KEY = 'tennis-platform-auth';

  static updateUser(user: User): void {
    const users = this.getAllUsers();
    const index = users.findIndex(u => u.id === user.id);
    
    if (index >= 0) {
      users[index] = user;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(users));
    }
  }

  static getAllPlayers(): User[] {
    return this.getAllUsers().filter(user => user.isOnboarded);
  }

  static getPlayerById(id: string): User | null {
    const users = this.getAllUsers();
    return users.find(user => user.id === id) || null;
  }

  static searchPlayers(query: string): User[] {
    const players = this.getAllPlayers();
    if (!query.trim()) return players;
    
    return players.filter(player => 
      player.name.toLowerCase().includes(query.toLowerCase()) ||
      player.skillLevel.toLowerCase().includes(query.toLowerCase())
    );
  }

  private static getAllUsers(): User[] {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  static initializeMockData(): void {
    const existingUsers = this.getAllUsers();
    if (existingUsers.length > 0) return;

    const mockUsers: User[] = [
      // Elite Players (Advanced)
      {
        id: 'mock_1',
        email: 'alex.quantum@tennis.pro',
        name: 'Alex Quantum',
        username: 'alex_quantum',
        phone: '+27 11 123 4567',
        location: 'Johannesburg, South Africa',
        bio: 'Professional tennis player with 15+ years of competitive experience. Former national junior champion.',
        skillLevel: 'Advanced',
        rating: 1850,
        matchesPlayed: 45,
        matchesWon: 34,
        isOnboarded: true,
      },
      {
        id: 'mock_2',
        email: 'sarah.nexus@tennis.pro',
        name: 'Sarah Nexus',
        username: 'sarah_nexus',
        phone: '+27 11 234 5678',
        location: 'Pretoria, South Africa',
        bio: 'Tennis coach and competitive player. Specializing in strategic gameplay and mental toughness.',
        skillLevel: 'Advanced',
        rating: 1720,
        matchesPlayed: 38,
        matchesWon: 27,
        isOnboarded: true,
      },
      {
        id: 'mock_3',
        email: 'mike.cyber@tennis.pro',
        name: 'Mike Cyber',
        username: 'mike_cyber',
        phone: '+27 11 345 6789',
        location: 'Cape Town, South Africa',
        bio: 'Weekend warrior with a passion for competitive tennis. Always looking to improve my game!',
        skillLevel: 'Intermediate',
        rating: 1450,
        matchesPlayed: 28,
        matchesWon: 16,
        isOnboarded: true,
      },
      {
        id: 'mock_4',
        email: 'emma.neon@tennis.pro',
        name: 'Emma Neon',
        username: 'emma_neon',
        phone: '+27 11 456 7890',
        location: 'Durban, South Africa',
        bio: 'Former university tennis captain. Love the competitive spirit and meeting new players.',
        skillLevel: 'Advanced',
        rating: 1680,
        matchesPlayed: 42,
        matchesWon: 29,
        isOnboarded: true,
      },
      {
        id: 'mock_5',
        email: 'david.pulse@tennis.pro',
        name: 'David Pulse',
        username: 'david_pulse',
        phone: '+27 11 567 8901',
        location: 'Midrand, South Africa',
        bio: 'Tennis enthusiast and local club champion. Enjoy both singles and doubles play.',
        skillLevel: 'Intermediate',
        rating: 1380,
        matchesPlayed: 33,
        matchesWon: 19,
        isOnboarded: true,
      },

      // Intermediate Players
      {
        id: 'mock_6',
        email: 'lisa.storm@tennis.pro',
        name: 'Lisa Storm',
        username: 'lisa_storm',
        phone: '+27 11 678 9012',
        location: 'Sandton, South Africa',
        bio: 'Rising player with strong baseline game. Training hard to reach advanced level.',
        skillLevel: 'Intermediate',
        rating: 1520,
        matchesPlayed: 25,
        matchesWon: 15,
        isOnboarded: true,
      },
      {
        id: 'mock_7',
        email: 'james.volt@tennis.pro',
        name: 'James Volt',
        username: 'james_volt',
        phone: '+27 11 789 0123',
        location: 'Randburg, South Africa',
        bio: 'Consistent player with excellent court coverage. Love playing in tournaments.',
        skillLevel: 'Intermediate',
        rating: 1420,
        matchesPlayed: 31,
        matchesWon: 18,
        isOnboarded: true,
      },
      {
        id: 'mock_8',
        email: 'nina.flash@tennis.pro',
        name: 'Nina Flash',
        username: 'nina_flash',
        phone: '+27 11 890 1234',
        location: 'Roodepoort, South Africa',
        bio: 'Fast and aggressive player. Known for powerful serves and quick net play.',
        skillLevel: 'Intermediate',
        rating: 1480,
        matchesPlayed: 29,
        matchesWon: 17,
        isOnboarded: true,
      },

      // Beginner to Intermediate Players
      {
        id: 'mock_9',
        email: 'tom.spark@tennis.pro',
        name: 'Tom Spark',
        username: 'tom_spark',
        phone: '+27 11 901 2345',
        location: 'Kempton Park, South Africa',
        bio: 'New to competitive tennis but learning fast. Excited to participate in tournaments!',
        skillLevel: 'Beginner',
        rating: 1150,
        matchesPlayed: 12,
        matchesWon: 5,
        isOnboarded: true,
      },
      {
        id: 'mock_10',
        email: 'amy.blaze@tennis.pro',
        name: 'Amy Blaze',
        username: 'amy_blaze',
        phone: '+27 11 012 3456',
        location: 'Boksburg, South Africa',
        bio: 'Determined beginner with great potential. Working on consistency and strategy.',
        skillLevel: 'Beginner',
        rating: 1200,
        matchesPlayed: 15,
        matchesWon: 7,
        isOnboarded: true,
      },
      {
        id: 'mock_11',
        email: 'ryan.thunder@tennis.pro',
        name: 'Ryan Thunder',
        username: 'ryan_thunder',
        phone: '+27 11 123 0456',
        location: 'Benoni, South Africa',
        bio: 'Improving rapidly with regular practice. Love the mental challenge of tennis.',
        skillLevel: 'Beginner',
        rating: 1180,
        matchesPlayed: 18,
        matchesWon: 8,
        isOnboarded: true,
      },
      {
        id: 'mock_12',
        email: 'zoe.lightning@tennis.pro',
        name: 'Zoe Lightning',
        username: 'zoe_lightning',
        phone: '+27 11 234 0567',
        location: 'Edenvale, South Africa',
        bio: 'Enthusiastic player with natural talent. Focused on developing all-around skills.',
        skillLevel: 'Intermediate',
        rating: 1350,
        matchesPlayed: 22,
        matchesWon: 12,
        isOnboarded: true,
      }
    ];

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(mockUsers));
  }
}