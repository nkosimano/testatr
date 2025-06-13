import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

type Tournament = Database['public']['Tables']['tournaments']['Row']
type TournamentInsert = Database['public']['Tables']['tournaments']['Insert']
type TournamentUpdate = Database['public']['Tables']['tournaments']['Update']
type TournamentParticipant = Database['public']['Tables']['tournament_participants']['Row']

interface TournamentState {
  tournaments: Tournament[]
  participants: Record<string, TournamentParticipant[]>
  loading: boolean
  fetchTournaments: () => Promise<void>
  fetchTournamentParticipants: (tournamentId: string) => Promise<void>
  createTournament: (tournament: TournamentInsert) => Promise<Tournament>
  updateTournament: (id: string, updates: TournamentUpdate) => Promise<void>
  registerForTournament: (tournamentId: string, playerId: string) => Promise<void>
  unregisterFromTournament: (tournamentId: string, playerId: string) => Promise<void>
}

export const useTournamentStore = create<TournamentState>((set, get) => ({
  tournaments: [],
  participants: {},
  loading: false,

  fetchTournaments: async () => {
    set({ loading: true })
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select(`
          *,
          organizer:profiles!tournaments_organizer_id_fkey(username)
        `)
        .order('start_date', { ascending: true })

      if (error) throw error
      set({ tournaments: data || [], loading: false })
    } catch (error: any) {
      console.error('Error fetching tournaments:', error)
      set({ loading: false })
      throw new Error(error.message || 'Failed to fetch tournaments')
    }
  },

  fetchTournamentParticipants: async (tournamentId: string) => {
    try {
      const { data, error } = await supabase
        .from('tournament_participants')
        .select(`
          *,
          player:profiles!tournament_participants_player_id_fkey(username, elo_rating)
        `)
        .eq('tournament_id', tournamentId)
        .order('seed', { ascending: true })

      if (error) throw error
      
      set(state => ({
        participants: {
          ...state.participants,
          [tournamentId]: data || []
        }
      }))
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch tournament participants')
    }
  },

  createTournament: async (tournament: TournamentInsert) => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .insert(tournament)
        .select()
        .single()

      if (error) throw error
      
      // Refresh tournaments
      await get().fetchTournaments()
      
      return data
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create tournament')
    }
  },

  updateTournament: async (id: string, updates: TournamentUpdate) => {
    try {
      const { error } = await supabase
        .from('tournaments')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
      
      // Refresh tournaments
      await get().fetchTournaments()
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update tournament')
    }
  },

  registerForTournament: async (tournamentId: string, playerId: string) => {
    try {
      const { error } = await supabase
        .from('tournament_participants')
        .insert({
          tournament_id: tournamentId,
          player_id: playerId
        })

      if (error) throw error
      
      // Refresh participants
      await get().fetchTournamentParticipants(tournamentId)
    } catch (error: any) {
      throw new Error(error.message || 'Failed to register for tournament')
    }
  },

  unregisterFromTournament: async (tournamentId: string, playerId: string) => {
    try {
      const { error } = await supabase
        .from('tournament_participants')
        .delete()
        .eq('tournament_id', tournamentId)
        .eq('player_id', playerId)

      if (error) throw error
      
      // Refresh participants
      await get().fetchTournamentParticipants(tournamentId)
    } catch (error: any) {
      throw new Error(error.message || 'Failed to unregister from tournament')
    }
  }
}))