import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
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

/**
 * Compares new rankings with previous rankings to determine rank changes.
 * @param newRankings The freshly fetched and ranked player data.
 * @param previousRankings The previously stored ranked player data.
 * @returns New rankings annotated with rank change status and value.
 */
const calculateRankChanges = (
  newRankings: RankingPlayer[],
  previousRankings: RankingPlayer[]
): RankingPlayer[] => {
  // Create a Map for efficient lookup of previous player ranks
  const previousRankingsMap = new Map(
    previousRankings.map((player) => [player.user_id, player])
  );

  return newRankings.map((player) => {
    const prevPlayer = previousRankingsMap.get(player.user_id);

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
      rankChangeValue,
    };
  });
};

/**
 * Fetches player profiles from Supabase and assigns a current rank.
 * @returns A promise that resolves to an array of RankingPlayer objects with their current ranks.
 */
const fetchRankings = async (): Promise<RankingPlayer[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, username, elo_rating, matches_played, matches_won, skill_level, profile_picture_url')
    .order('elo_rating', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  // Assign a rank to each player based on their ELO rating
  return data.map((player, index) => ({
    ...player,
    rank: index + 1
  }));
};

/**
 * Custom React Hook to fetch, calculate rank changes, and persist player rankings.
 * It uses TanStack Query for data fetching and caching, and localStorage for persistence.
 */
export const useRankings = () => {
  const queryClient = useQueryClient();

  const queryResult = useQuery({
    queryKey: ['rankings'],
    queryFn: fetchRankings,
    staleTime: 60000, // Data is considered fresh for 1 minute
    refetchOnWindowFocus: false, // Do not refetch automatically on window focus
    retry: 3, // Retry failed queries up to 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff for retries

    // onSuccess is called with the raw data returned by queryFn (fetchRankings)
    // This is the perfect place to reliably persist the *latest* fetched data.
    onSuccess: (data: RankingPlayer[]) => {
      try {
        localStorage.setItem(RANKINGS_STORAGE_KEY, JSON.stringify(data));
      } catch (error) {
        console.error('Error saving current rankings to localStorage:', error);
      }
    },

    // select is used to transform the data *after* it's fetched and cached,
    // but *before* it's returned by the useQuery hook.
    // It receives the data that was just successfully fetched (and saved by onSuccess).
    select: (newRankings: RankingPlayer[]): RankingPlayer[] => {
      let previousRankings: RankingPlayer[] = [];
      try {
        const stored = localStorage.getItem(RANKINGS_STORAGE_KEY);
        if (stored) {
          previousRankings = JSON.parse(stored);
        }
      } catch (error) {
        console.error('Error loading or parsing previous rankings from localStorage:', error);
        // Clear corrupted data to prevent future errors
        localStorage.removeItem(RANKINGS_STORAGE_KEY);
      }

      // Calculate rank changes using the dedicated helper function
      return calculateRankChanges(newRankings, previousRankings);
    },
  });

  // Set up real-time subscription to profiles table changes
  // This will invalidate the 'rankings' query, triggering a refetch.
  useEffect(() => {
    const channel = supabase
      .channel('rankings-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE', // Listen for updates to player ELO, matches played/won
          schema: 'public',
          table: 'profiles',
          columns: ['elo_rating', 'matches_played', 'matches_won']
        },
        () => {
          // Invalidate the 'rankings' query to trigger a refetch
          queryClient.invalidateQueries({ queryKey: ['rankings'] });
        }
      )
      .subscribe();

    // Cleanup function: unsubscribe from the channel when the component unmounts
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]); // Dependency array includes queryClient to ensure it's up-to-date

  // The 'data' property of queryResult already contains the transformed rankings
  // due to the 'select' option.
  return {
    ...queryResult,
    rankings: queryResult.data || [] // Ensure rankings is always an array
  };
};