import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface RankingPlayer {
  user_id: string;
  username: string;
  elo_rating: number;
  matches_played: number;
  matches_won: number;
  skill_level: string;
  rank?: number;
  rankChange?: 'up' | 'down' | 'same' | 'new';
  rankChangeValue?: number;
}

const RANKINGS_STORAGE_KEY = 'africa-tennis-previous-rankings';

const fetchRankings = async (): Promise<RankingPlayer[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, username, elo_rating, matches_played, matches_won, skill_level')
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
  const saveTimeoutRef = useRef<number | null>(null);
  const isInitialLoadRef = useRef(true);

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

  // Save current rankings to localStorage
  const savePreviousRankings = (rankings: RankingPlayer[]) => {
    try {
      // Clear any existing timeout to prevent race conditions
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
      
      // Use setTimeout to debounce the save operation
      saveTimeoutRef.current = window.setTimeout(() => {
        localStorage.setItem(RANKINGS_STORAGE_KEY, JSON.stringify(rankings));
        saveTimeoutRef.current = null;
      }, 500);
    } catch (error) {
      console.error('Error saving previous rankings:', error);
    }
  };

  const { data: currentRankings = [], ...queryResult } = useQuery({
    queryKey: ['rankings'],
    queryFn: fetchRankings,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  });

  // Calculate rank changes by comparing with previous rankings
  const rankingsWithChanges = currentRankings.map(player => {
    // Only load previous rankings once on initial load
    const previousRankings = isInitialLoadRef.current ? loadPreviousRankings() : [];
    const prevPlayer = previousRankings.find(p => p.user_id === player.user_id);
    
    let rankChange: 'up' | 'down' | 'same' | 'new' = 'new';
    let rankChangeValue = 0;
    
    if (prevPlayer) {
      if (player.rank && prevPlayer.rank) {
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
    }
    
    return {
      ...player,
      rankChange,
      rankChangeValue
    };
  });

  // Save rankings when component unmounts or when rankings change
  useEffect(() => {
    if (currentRankings.length > 0 && !isInitialLoadRef.current) {
      savePreviousRankings(currentRankings);
    }
    
    // Mark initial load as complete after first render
    if (isInitialLoadRef.current && currentRankings.length > 0) {
      isInitialLoadRef.current = false;
    }
    
    return () => {
      // Save on unmount
      if (currentRankings.length > 0) {
        savePreviousRankings(currentRankings);
      }
      
      // Clear any pending timeout
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
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