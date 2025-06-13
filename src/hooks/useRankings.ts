import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export interface RankedPlayer {
  userId: string;
  username: string;
  eloRating: number;
  matchesPlayed: number;
  matchesWon: number;
  skillLevel: string;
  rank: number;
  previousRank: number | null;
  rankChange: 'up' | 'down' | 'same' | 'new';
  rankChangeValue: number;
  eloChange: number;
}

export const useRankings = () => {
  const [players, setPlayers] = useState<RankedPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const profilesRef = useRef<any[]>([]);

  const fetchRankings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: currentProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('elo_rating', { ascending: false });

      if (profilesError) throw profilesError;

      profilesRef.current = currentProfiles || [];

      if (!currentProfiles || currentProfiles.length === 0) {
        setPlayers([]);
        return;
      }

      const storedRankingsStr = localStorage.getItem('previous_rankings');
      let storedRankings: { user_id: string; elo_rating: number }[] = [];

      try {
        if (storedRankingsStr) {
          storedRankings = JSON.parse(storedRankingsStr);
        }
      } catch (e) {
        console.error('Error parsing stored rankings:', e);
        storedRankings = [];
      }

      const previousDataMap = new Map<string, { rank: number; eloRating: number }>();
      if (Array.isArray(storedRankings)) {
        storedRankings.forEach((player, index) => {
          if (player && player.user_id) {
            previousDataMap.set(player.user_id, {
              rank: index + 1,
              eloRating: player.elo_rating,
            });
          }
        });
      }

      const rankedPlayers: RankedPlayer[] = currentProfiles.map((profile, index) => {
        const currentRank = index + 1;
        const previousData = previousDataMap.get(profile.user_id);
        const previousRank = previousData ? previousData.rank : null;
        const previousElo = previousData ? previousData.eloRating : profile.elo_rating;
        let rankChange: 'up' | 'down' | 'same' | 'new' = 'same';
        let rankChangeValue = 0;
        if (previousRank === null) {
          rankChange = 'new';
        } else if (currentRank < previousRank) {
          rankChange = 'up';
          rankChangeValue = previousRank - currentRank;
        } else if (currentRank > previousRank) {
          rankChange = 'down';
          rankChangeValue = currentRank - previousRank;
        }
        const eloChange = profile.elo_rating - previousElo;
        return {
          userId: profile.user_id,
          username: profile.username,
          eloRating: profile.elo_rating,
          matchesPlayed: profile.matches_played,
          matchesWon: profile.matches_won,
          skillLevel: profile.skill_level,
          rank: currentRank,
          previousRank,
          rankChange,
          rankChangeValue,
          eloChange,
        };
      });

      setPlayers(rankedPlayers);
    } catch (err: any) {
      console.error('Error fetching rankings:', err);
      setError(err.message || 'Failed to load rankings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateBaseline = useCallback(() => {
    if (profilesRef.current.length > 0) {
      localStorage.setItem(
        'previous_rankings',
        JSON.stringify(
          profilesRef.current.map(p => ({
            user_id: p.user_id,
            elo_rating: p.elo_rating,
          }))
        )
      );
    }
  }, []);

  useEffect(() => {
    fetchRankings();
    const subscription = supabase
      .channel('rankings-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          fetchRankings();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [fetchRankings]);

  return { players, isLoading, error, updateBaseline };
};