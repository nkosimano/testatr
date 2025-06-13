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
  profile_picture_url?: string | null;
}

const RANKINGS_STORAGE_KEY = 'africa-tennis-previous-rankings';

const fetchRankings = async (): Promise<RankingPlayer[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, username, elo_rating, matches_played, matches_won, skill_level, profile_picture_url')
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
  const initialLoadCompletedRef = useRef(false);
  const previousRankingsRef = useRef<RankingPlayer[]>([]);

  // Load previous rankings from localStorage only once at initialization
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RANKINGS_STORAGE_KEY);
      if (stored) {
        previousRankingsRef.current = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading previous rankings:', error);
      // Clear potentially corrupted data
      localStorage.removeItem(RANKINGS_STORAGE_KEY);
    }
  }, []);

  // Save current rankings to localStorage when component unmounts
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const { data: currentRankings = [], ...queryResult } = useQuery({
    queryKey: ['rankings'],
    queryFn: fetchRankings,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Calculate rank changes by comparing with previous rankings
  const rankingsWithChanges = currentRankings.map(player => {
    const prevPlayer = previousRankingsRef.current.find(p => p.user_id === player.user_id);
    
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
    if (currentRankings.length > 0 && initialLoadCompletedRef.current) {
      // Clear any existing timeout
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
      
      // Save the current rankings to localStorage when navigating away
      const handleBeforeUnload = () => {
        localStorage.setItem(RANKINGS_STORAGE_KEY, JSON.stringify(currentRankings));
      };
      
      window.addEventListener('beforeunload', handleBeforeUnload);
      
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        localStorage.setItem(RANKINGS_STORAGE_KEY, JSON.stringify(currentRankings));
      };
    } else if (currentRankings.length > 0 && !initialLoadCompletedRef.current) {
      // Mark initial load as complete
      initialLoadCompletedRef.current = true;
    }
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