import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type TournamentInsert = Database['public']['Tables']['tournaments']['Insert'];
type TournamentUpdate = Database['public']['Tables']['tournaments']['Update'];

const createTournamentFn = async (tournament: TournamentInsert) => {
  const { data, error } = await supabase.from('tournaments').insert(tournament).select().single();
  if (error) throw error;
  return data;
};

const updateTournamentFn = async ({ id, updates }: { id: string; updates: TournamentUpdate }) => {
  const { error } = await supabase.from('tournaments').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
};

const registerForTournamentFn = async ({ tournamentId, playerId }: { tournamentId: string; playerId: string }) => {
  const { error } = await supabase.from('tournament_participants').insert({ tournament_id: tournamentId, player_id: playerId });
  if (error) throw error;
};

const unregisterFromTournamentFn = async ({ tournamentId, playerId }: { tournamentId: string; playerId: string }) => {
  const { error } = await supabase.from('tournament_participants').delete().eq('tournament_id', tournamentId).eq('player_id', playerId);
  if (error) throw error;
};

export const useTournamentMutations = () => {
  const queryClient = useQueryClient();

  const createTournament = useMutation({
    mutationFn: createTournamentFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
    },
  });

  const updateTournament = useMutation({
    mutationFn: updateTournamentFn,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['tournament', variables.id] });
    },
  });

  const registerForTournament = useMutation({
    mutationFn: registerForTournamentFn,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['tournamentParticipants', variables.tournamentId] });
    },
  });

  const unregisterFromTournament = useMutation({
    mutationFn: unregisterFromTournamentFn,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['tournamentParticipants', variables.tournamentId] });
    },
  });

  return {
    createTournament,
    updateTournament,
    registerForTournament,
    unregisterFromTournament,
  };
};