import { useState, useEffect } from 'react';
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
}

export const useRankings = () => {
  const [players, setPlayers] = useState<RankedPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const fetchRankings = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Get current rankings
        const { data: currentProfiles, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .order('elo_rating', { ascending: false });
          
        if (profilesError) throw profilesError;
        
        if (!currentProfiles || currentProfiles.length === 0) {
          setPlayers([]);
          setIsLoading(false);
          return;
        }
        
        // Get previous rankings from local storage
        const storedRankingsStr = localStorage.getItem('previous_rankings');
        let storedRankings: any[] = [];
        
        try {
          if (storedRankingsStr) {
            storedRankings = JSON.parse(storedRankingsStr);
          }
        } catch (e) {
          console.error('Error parsing stored rankings:', e);
          // If there's an error parsing, just use an empty array
          storedRankings = [];
        }
        
        // Map to create a lookup of previous ranks by user_id
        const previousRankMap = new Map();
        if (Array.isArray(storedRankings)) {
          storedRankings.forEach((player, index) => {
            if (player && player.user_id) {
              previousRankMap.set(player.user_id, index + 1);
            }
          });
        }
        
        // Process current rankings with rank changes
        const rankedPlayers: RankedPlayer[] = currentProfiles.map((profile, index) => {
          const currentRank = index + 1;
          const previousRank = previousRankMap.has(profile.user_id) 
            ? previousRankMap.get(profile.user_id) 
            : null;
          
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
            rankChangeValue
          };
        });
        
        // Store current rankings for future comparison
        // Only store the essential data needed for rank comparison
        localStorage.setItem('previous_rankings', JSON.stringify(
          currentProfiles.map(p => ({ 
            user_id: p.user_id, 
            elo_rating: p.elo_rating 
          }))
        ));
        
        setPlayers(rankedPlayers);
        setLastUpdated(new Date());
      } catch (err: any) {
        console.error('Error fetching rankings:', err);
        setError(err.message || 'Failed to load rankings');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchRankings();
    
    // Set up subscription for real-time updates
    const subscription = supabase
      .channel('rankings-changes')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'profiles', columns: ['elo_rating', 'matches_played', 'matches_won'] }, 
        () => {
          fetchRankings();
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);
  
  return { players, isLoading, error, lastUpdated };
};