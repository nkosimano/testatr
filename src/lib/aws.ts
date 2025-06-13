// AWS Lambda function URLs and API Gateway endpoints
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.your-domain.com'

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

class ApiClient {
  private baseUrl: string
  private token: string | null = null

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  setAuthToken(token: string) {
    this.token = token
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers
    }

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`)
      }

      return data
    } catch (error: any) {
      console.error(`API request failed: ${endpoint}`, error)
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  }

  // User profile operations
  async createUserProfile(userData: {
    userId: string
    username: string
    email: string
  }) {
    return this.request('/users/profile', {
      method: 'POST',
      body: JSON.stringify(userData)
    })
  }

  // Match operations
  async getMatches(userId: string) {
    return this.request(`/matches?userId=${userId}`);
  }

  // Match operations
  async createMatch(matchData: {
    player1Id: string
    player2Id: string
    tournamentId?: string
    date: string
    location: string
  }) {
    return this.request('/matches', {
      method: 'POST',
      body: JSON.stringify(matchData)
    })
  }

  async updateMatchResult(matchId: string, result: {
    winnerId: string
    score: string
    pgn?: string
  }) {
    return this.request(`/matches/${matchId}/result`, {
      method: 'PUT',
      body: JSON.stringify(result)
    })
  }

  // ELO calculation
  async calculateElo(matchId: string) {
    return this.request(`/matches/${matchId}/calculate-elo`, {
      method: 'POST'
    })
  }

  // Tennis scoring operations
  async updateMatchScore(matchId: string, data: {
    winningPlayerId: string;
    pointType?: string;
  }) {
    return this.request(`/matches/${matchId}/score`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  // Tournament operations
  async generateTournamentBracket(tournamentId: string) {
    return this.request(`/tournaments/${tournamentId}/generate-bracket`, {
      method: 'POST'
    })
  }
}

export const apiClient = new ApiClient(API_BASE_URL)

// Helper to set auth token from Supabase session
export const setApiAuthToken = (token: string) => {
  apiClient.setAuthToken(token)
}