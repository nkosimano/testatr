import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { apiClient } from '../lib/aws';
import type { Database } from '../types/database';

type Match = Database['public']['Tables']['matches']['Row'];

const fetchMatches = async (userId?: string): Promise<Match[]> => {
  if (!userId) {
    return [];
  }
  const response = await apiClient.getMatches(userId);
  if (!response.success) {
    throw new Error(response.error || 'Failed to fetch matches');
  }
  return Array.isArray(response.data) ? response.data : [];
};

export const useMatches = (userId?: string) => {
  const queryClient = useQueryClient();

  const queryResult = useQuery({
    queryKey: ['matches', userId],
    queryFn: () => fetchMatches(userId),
    enabled: !!userId,
  });

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`matches-for-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `or(player1_id.eq.${userId},player2_id.eq.${userId})`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['matches', userId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return queryResult;
};
