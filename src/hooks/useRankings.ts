import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useEffect, useState } from 'react';

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
  rankChange?: 'up' | 'down' | 'same' | 'new';
  rankChangeValue?: number;
  previousRank?: number;
}

// Key for storing previous rankings in localStorage
const PREVIOUS_RANKINGS_KEY = 'previous-rankings';

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

// Save current rankings to localStorage
const saveCurrentRankings = (players: Player[]) => {
  // Only save the essential data: user_id and rank
  const rankingsData = players.map((player, index) => ({
    user_id: player.user_id,
    rank: index + 1,
    elo_rating: player.elo_rating
  }));
  
  localStorage.setItem(PREVIOUS_RANKINGS_KEY, JSON.stringify({
    timestamp: new Date().toISOString(),
    rankings: rankingsData
  }));
};

// Get previous rankings from localStorage
const getPreviousRankings = (): Record<string, number> => {
  const data = localStorage.getItem(PREVIOUS_RANKINGS_KEY);
  if (!data) return {};
  
  try {
    const parsedData = JSON.parse(data);
    // Convert to a map of user_id -> rank for easy lookup
    const rankingsMap: Record<string, number> = {};
    parsedData.rankings.forEach((item: { user_id: string; rank: number }) => {
      rankingsMap[item.user_id] = item.rank;
    });
    return rankingsMap;
  } catch (e) {
    console.error('Error parsing previous rankings:', e);
    return {};
  }
};

export const useRankings = () => {
  const queryClient = useQueryClient();
  const [previousRankings, setPreviousRankings] = useState<Record<string, number>>({});
  
  // Load previous rankings on initial render
  useEffect(() => {
    setPreviousRankings(getPreviousRankings());
  }, []);
  
  const { data: rawPlayers, isLoading, error } = useQuery({
    queryKey: ['rankings'],
    queryFn: fetchPlayers,
  });
  
  // Process players with rank changes
  const players = rawPlayers?.map((player, index) => {
    const currentRank = index + 1;
    const previousRank = previousRankings[player.user_id];
    
    let rankChange: 'up' | 'down' | 'same' | 'new' = 'same';
    let rankChangeValue = 0;
    
    if (previousRank === undefined) {
      // New player
      rankChange = 'new';
    } else if (previousRank < currentRank) {
      // Rank decreased (moved down)
      rankChange = 'down';
      rankChangeValue = currentRank - previousRank;
    } else if (previousRank > currentRank) {
      // Rank increased (moved up)
      rankChange = 'up';
      rankChangeValue = previousRank - currentRank;
    }
    
    return {
      ...player,
      rank: currentRank,
      rankChange,
      rankChangeValue,
      previousRank
    };
  });
  
  // Save current rankings when they change
  useEffect(() => {
    if (rawPlayers && rawPlayers.length > 0) {
      saveCurrentRankings(rawPlayers);
    }
  }, [rawPlayers]);
  
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