import { User } from '../types';

export class AuthService {
  private static STORAGE_KEY = 'tennis-platform-auth';
  private static TOKEN_KEY = 'tennis-platform-token';

  static async login(email: string): Promise<{ user: User; token: string }> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Check if user exists
    let user = this.getUserByEmail(email);
    
    if (!user) {
      // Create new user
      user = {
        id: this.generateId(),
        email,
        name: '',
        skillLevel: 'Beginner',
        rating: 1200,
        matchesPlayed: 0,
        matchesWon: 0,
        isOnboarded: false,
      };
      this.saveUser(user);
    }

    const token = this.generateToken();
    localStorage.setItem(this.TOKEN_KEY, token);
    
    return { user, token };
  }

  static async getCurrentUser(): Promise<User | null> {
    try {
      const token = localStorage.getItem(this.TOKEN_KEY);
      if (!token) return null;

      const users = this.getAllUsers();
      const currentUser = users.find(user => user.email);
      
      if (!currentUser) {
        // Clear invalid token
        localStorage.removeItem(this.TOKEN_KEY);
        return null;
      }
      
      return currentUser;
    } catch (error) {
      console.error('Error getting current user:', error);
      // Clear potentially corrupted data
      localStorage.removeItem(this.TOKEN_KEY);
      return null;
    }
  }

  static logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  static async fetchProfile(): Promise<User | null> {
    try {
      // This method is called by the auth store
      // Return the current user without making external API calls
      return this.getCurrentUser();
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  }

  private static getUserByEmail(email: string): User | null {
    try {
      const users = this.getAllUsers();
      return users.find(user => user.email === email) || null;
    } catch (error) {
      console.error('Error getting user by email:', error);
      return null;
    }
  }

  private static getAllUsers(): User[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error parsing stored users:', error);
      return [];
    }
  }

  private static saveUser(user: User): void {
    try {
      const users = this.getAllUsers();
      const existingIndex = users.findIndex(u => u.id === user.id);
      
      if (existingIndex >= 0) {
        users[existingIndex] = user;
      } else {
        users.push(user);
      }
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(users));
    } catch (error) {
      console.error('Error saving user:', error);
    }
  }

  private static generateId(): string {
    return 'user_' + Math.random().toString(36).substr(2, 9);
  }

  private static generateToken(): string {
    return 'token_' + Math.random().toString(36).substr(2, 16);
  }
}