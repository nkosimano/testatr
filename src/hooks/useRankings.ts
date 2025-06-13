import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface RankingPlayer {
  user_id: string;
  username: string;
  elo_rating: number;
  matches_played: number;
  matches_won: number;
  rank?: number;
  previousRank?: number;
  rankChange?: 'up' | 'down' | 'same' | 'new';
  rankChangeValue?: number;
}

const RANKINGS_STORAGE_KEY = 'africa-tennis-previous-rankings';

const fetchRankings = async (): Promise<RankingPlayer[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, username, elo_rating, matches_played, matches_won')
    .order('elo_rating', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  // Add rank to each player
  return data.map((player, index) => ({
    ...player,
    rank: index + 1
  }));
};

export const useRankings = () => {
  const queryClient = useQueryClient();

  // Load previous rankings from localStorage
  const loadPreviousRankings = (): RankingPlayer[] => {
    try {
      const stored = localStorage.getItem(RANKINGS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading previous rankings:', error);
      return [];
    }
  };

  // Save current rankings to localStorage when component unmounts
  const savePreviousRankings = (rankings: RankingPlayer[]) => {
    try {
      localStorage.setItem(RANKINGS_STORAGE_KEY, JSON.stringify(rankings));
    } catch (error) {
      console.error('Error saving previous rankings:', error);
    }
  };

  const { data: currentRankings = [], ...queryResult } = useQuery({
    queryKey: ['rankings'],
    queryFn: fetchRankings,
  });

  // Calculate rank changes by comparing with previous rankings
  const rankingsWithChanges = currentRankings.map(player => {
    const previousRankings = loadPreviousRankings();
    const prevPlayer = previousRankings.find(p => p.user_id === player.user_id);
    
    let rankChange: 'up' | 'down' | 'same' | 'new' = 'new';
    let rankChangeValue = 0;
    let previousRank: number | undefined = undefined;
    
    if (prevPlayer) {
      previousRank = prevPlayer.rank;
      
      if (player.rank < prevPlayer.rank) {
        rankChange = 'up';
        rankChangeValue = prevPlayer.rank - player.rank;
      } else if (player.rank > prevPlayer.rank) {
        rankChange = 'down';
        rankChangeValue = player.rank - prevPlayer.rank;
      } else {
        rankChange = 'same';
      }
    }
    
    return {
      ...player,
      previousRank,
      rankChange,
      rankChangeValue
    };
  });

  // Save rankings when component unmounts
  useEffect(() => {
    return () => {
      if (currentRankings.length > 0) {
        savePreviousRankings(currentRankings);
      }
    };
  }, [currentRankings]);

  // Set up real-time subscription to rankings changes
  useEffect(() => {
    const channel = supabase
      .channel('rankings-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          columns: ['elo_rating', 'matches_played', 'matches_won']
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
    ...queryResult,
    rankings: rankingsWithChanges
  };
};