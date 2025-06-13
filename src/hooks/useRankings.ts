import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useEffect } from 'react';

interface Player {
  user_id: string;
  username: string;
  elo_rating: number;
  matches_played: number;
  matches_won: number;
  skill_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  bio: string | null;
  profile_picture_url: string | null;
  created_at: string;
  updated_at: string;
  rank?: number;
  rankChange?: 'up' | 'down' | 'same';
  rankChangeValue?: number;
}

const fetchPlayers = async (): Promise<Player[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('elo_rating', { ascending: false });
    
  if (error) {
    throw new Error(`Error fetching players: ${error.message}`);
  }
  
  return data || [];
};

export const useRankings = () => {
  const queryClient = useQueryClient();
  
  const { data: players, isLoading, error } = useQuery({
    queryKey: ['rankings'],
    queryFn: fetchPlayers,
  });
  
  // Set up real-time subscription for profile changes
  useEffect(() => {
    const channel = supabase
      .channel('rankings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['rankings'] });
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
  
  return {
    players,
    isLoading,
    error,
  };
};