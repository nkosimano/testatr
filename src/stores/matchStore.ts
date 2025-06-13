import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { apiClient } from '../lib/aws'
import type { Database } from '../types/database'

type Match = Database['public']['Tables']['matches']['Row']
type MatchInsert = Database['public']['Tables']['matches']['Insert']
type MatchUpdate = Database['public']['Tables']['matches']['Update']

interface MatchState {
  matches: Match[]
  loading: boolean
  fetchMatches: (userId?: string) => Promise<void>
  createMatch: (match: MatchInsert) => Promise<Match>
  updateMatch: (id: string, updates: MatchUpdate) => Promise<void>
  subscribeToMatches: (userId: string) => () => void
  awardPoint: (matchId: string, winningPlayerId: string, pointType?: string) => Promise<any>
}

export const useMatchStore = create<MatchState>((set, get) => ({
  matches: [],
  loading: false,

  // Fetch all matches or matches for a specific user
  fetchMatches: async (userId?: string) => {
    set({ loading: true })
    
    if (!userId) {
      console.warn("fetchMatches called without a userId");
      set({ loading: false });
      return;
    }
    
    try {
      // Call the AWS Lambda function instead of Supabase directly
      const response = await apiClient.getMatches(userId);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch matches');
      }
      
      set({ matches: response.data || [], loading: false });
    } catch (error: any) {
      console.error('Error fetching matches:', error)
      set({ loading: false })
      throw new Error(error.message || 'Failed to fetch matches')
    }
  },

  createMatch: async (match: MatchInsert) => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .insert(match)
        .select()
        .single()

      if (error) throw error
      
      // Refresh matches
      await get().fetchMatches()
      
      return data
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create match')
    }
  },

  updateMatch: async (id: string, updates: MatchUpdate) => {
    try {
      const { error } = await supabase
        .from('matches')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
      
      // Refresh matches
      await get().fetchMatches()
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update match')
    }
  },

  // Award a point to a player during live scoring
  awardPoint: async (matchId: string, winningPlayerId: string, pointType: string = 'point_won') => {
    try {
      // Call the AWS Lambda function instead of the Supabase Edge Function
      const response = await apiClient.updateMatchScore(matchId, {
        winningPlayerId,
        pointType
      });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to update score');
      }
      
      return response.data;
    } catch (error: any) {
      console.error('Error awarding point:', error);
      throw new Error(error.message || 'Failed to award point');
    }
  },

  subscribeToMatches: (userId: string) => {
    const subscription = supabase
      .channel('matches')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `or(player1_id.eq.${userId},player2_id.eq.${userId})`
        },
        () => {
          get().fetchMatches(userId)
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }
}))