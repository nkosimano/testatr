import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

// Player data structure
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

// Key for browser's local storage
const RANKINGS_STORAGE_KEY = 'africa-tennis-previous-rankings';

/**
 * Compares new rankings with previous rankings to determine changes.
 * This is a pure utility function for the comparison logic.
 */
const calculateRankChanges = (
  newRankings: RankingPlayer[],
  previousRankings: RankingPlayer[] | null
): RankingPlayer[] => {
  if (!previousRankings || previousRankings.length === 0) {
    return newRankings.map((p) => ({ ...p, rankChange: 'new', rankChangeValue: 0 }));
  }

  const previousRankingsMap = new Map(
    previousRankings.map((player) => [player.user_id, player])
  );

  return newRankings.map((player) => {
    const prevPlayer = previousRankingsMap.get(player.user_id);
    let rankChange: 'up' | 'down' | 'same' | 'new' = 'new';
    let rankChangeValue = 0;

    if (prevPlayer && player.rank != null && prevPlayer.rank != null) {
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
    
    return { ...player, rankChange, rankChangeValue };
  });
};

/**
 * Fetches player profiles from Supabase and assigns rank based on ELO.
 */
const fetchRankings = async (): Promise<RankingPlayer[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, username, elo_rating, matches_played, matches_won, skill_level, profile_picture_url')
    .order('elo_rating', { ascending: false });

  if (error) throw new Error(error.message);

  return data.map((player, index) => ({ ...player, rank: index + 1 }));
};

/**
 * The primary custom hook for the rankings feature.
 */
export const useRankings = () => {
  const queryClient = useQueryClient();

  // Read previous session's data from localStorage ONCE, before the query runs.
  const previousRankings = (() => {
    try {
      const stored = localStorage.getItem(RANKINGS_STORAGE_KEY);
      return stored ? (JSON.parse(stored) as RankingPlayer[]) : null;
    } catch (error) {
      console.error('Failed to parse previous rankings:', error);
      localStorage.removeItem(RANKINGS_STORAGE_KEY);
      return null;
    }
  })();

  const queryResult = useQuery({
    queryKey: ['rankings'],
    queryFn: fetchRankings,
    staleTime: 60000,
    refetchOnWindowFocus: false,

    // Use `select` to transform the data before it's returned to the component.
    // This function uses the `previousRankings` variable captured from the hook's outer scope.
    select: (newRankings: RankingPlayer[]): RankingPlayer[] => {
      return calculateRankChanges(newRankings, previousRankings);
    },

    // Use `onSuccess` as a side-effect to reliably save the newly fetched data
    // for the next session. This receives the raw, untransformed data.
    onSuccess: (data: RankingPlayer[]) => {
      try {
        localStorage.setItem(RANKINGS_STORAGE_KEY, JSON.stringify(data));
      } catch (error) {
        console.error('Failed to save current rankings:', error);
      }
    },
  });

  // Real-time subscription to invalidate the query on profile updates.
  useEffect(() => {
    const channel = supabase
      .channel('rankings-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          columns: ['elo_rating', 'matches_played', 'matches_won'],
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
    rankings: queryResult.data || [],
  };
};