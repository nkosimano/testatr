import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Zap, 
  Target, 
  X, 
  RotateCcw, 
  Plus, 
  Loader2, 
  AlertTriangle,
  CheckCircle,
  ArrowLeft
} from 'lucide-react';
import { useMatchStore } from '../../stores/matchStore';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/database';

type Match = Database['public']['Tables']['matches']['Row'] & {
  player1?: { username: string; elo_rating: number };
  player2?: { username: string; elo_rating: number };
};

type PointType = 'point_won' | 'ace' | 'winner' | 'double_fault' | 'forced_error' | 'unforced_error';

interface MatchScoringProps {
  match: Match;
  onBack: () => void;
}

interface TennisScore {
  sets: Array<{
    player1_games: number;
    player2_games: number;
    games: Array<{
      player1_points: number;
      player2_points: number;
      server_id: string;
    }>;
  }>;
  current_game: {
    player1: string;
    player2: string;
  };
  server_id: string;
  is_tiebreak: boolean;
}

export const MatchScoring: React.FC<MatchScoringProps> = ({ match, onBack }) => {
  const [score, setScore] = useState<TennisScore | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pointType, setPointType] = useState<PointType>('point_won');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmEndMatch, setConfirmEndMatch] = useState(false);
  
  const { awardPoint } = useMatchStore();

  useEffect(() => {
    // Initialize score from match data
    if (match && match.score) {
      try {
        const parsedScore = typeof match.score === 'string' 
          ? JSON.parse(match.score) 
          : match.score;
        
        setScore(parsedScore);
      } catch (err) {
        console.error('Error parsing score:', err);
        setError('Error loading match score');
      }
    } else {
      // Initialize with default score
      setScore({
        sets: [],
        current_game: { player1: '0', player2: '0' },
        server_id: match.player1_id,
        is_tiebreak: false
      });
    }

    // Subscribe to real-time updates for this match
    const subscription = supabase
      .channel(`match-${match.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${match.id}`
        },
        (payload) => {
          if (payload.new && payload.new.score) {
            setScore(payload.new.score as TennisScore);
            
            // If match is completed, show success message
            if (payload.new.status === 'completed') {
              setSuccessMessage('Match completed!');
              setTimeout(() => {
                onBack();
              }, 3000);
            }
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [match.id]);

  const handleAwardPoint = async (playerId: string) => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      await awardPoint(match.id, playerId, pointType);
      setPointType('point_won'); // Reset point type after successful submission
    } catch (err: any) {
      console.error('Error awarding point:', err);
      setError(err.message || 'Failed to award point');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEndMatch = async () => {
    setConfirmEndMatch(true);
  };

  const confirmMatchEnd = async () => {
    setIsSubmitting(true);
    try {
      await supabase
        .from('matches')
        .update({ 
          status: 'completed',
          // Determine winner based on sets won
          winner_id: getMatchWinner()
        })
        .eq('id', match.id);
      
      setSuccessMessage('Match completed successfully!');
      setTimeout(() => {
        onBack();
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to end match');
    } finally {
      setIsSubmitting(false);
      setConfirmEndMatch(false);
    }
  };

  const getMatchWinner = (): string => {
    if (!score || !score.sets || score.sets.length === 0) {
      return match.player1_id; // Default to player1 if no score data
    }
    
    let player1Sets = 0;
    let player2Sets = 0;
    
    score.sets.forEach(set => {
      if (set.player1_games > set.player2_games) {
        player1Sets++;
      } else if (set.player2_games > set.player1_games) {
        player2Sets++;
      }
    });
    
    return player1Sets > player2Sets ? match.player1_id : match.player2_id;
  };

  const getPointTypeLabel = (type: PointType): string => {
    switch (type) {
      case 'ace': return 'Ace';
      case 'winner': return 'Winner';
      case 'double_fault': return 'Double Fault';
      case 'forced_error': return 'Forced Error';
      case 'unforced_error': return 'Unforced Error';
      default: return 'Point';
    }
  };

  const getPointTypeColor = (type: PointType): string => {
    switch (type) {
      case 'ace': return 'var(--accent-yellow)';
      case 'winner': return 'var(--success-green)';
      case 'double_fault': return 'var(--error-pink)';
      case 'forced_error': return 'var(--warning-orange)';
      case 'unforced_error': return 'var(--nebula-purple)';
      default: return 'var(--quantum-cyan)';
    }
  };

  if (!score) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="umpire-scoring-page">
      <div className="umpire-scoring-container">
        {/* Header */}
        <div className="umpire-scoring-header">
          <button
            onClick={onBack}
            className="umpire-back-btn"
            disabled={isSubmitting}
          >
            <ArrowLeft size={20} />
          </button>
          <div className="umpire-scoring-match-info">
            Live Scoring: {match.player1?.username} vs {match.player2?.username}
          </div>
          <div className="umpire-scoring-set">
            {score.is_tiebreak ? 'Tiebreak' : `Set ${score.sets.length + 1}`}
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4 mb-4">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-md p-4 mb-4">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              <span>{successMessage}</span>
            </div>
          </div>
        )}

        {/* Scoreboard */}
        <div className="bg-glass-bg backdrop-filter-blur border border-glass-border rounded-lg p-6 mb-6">
          <div className="grid grid-cols-3 gap-4">
            {/* Player 1 */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="player-avatar">
                  {match.player1?.username.charAt(0).toUpperCase() || 'P1'}
                </div>
                <div className="font-bold text-lg">{match.player1?.username || 'Player 1'}</div>
                {score.server_id === match.player1_id && (
                  <div className="w-3 h-3 bg-accent-yellow rounded-full animate-pulse" title="Serving"></div>
                )}
              </div>
              
              {/* Sets */}
              <div className="flex justify-center gap-2 mb-4">
                {score.sets.map((set, index) => (
                  <div 
                    key={index} 
                    className="w-8 h-8 flex items-center justify-center bg-bg-elevated border border-border-subtle rounded-md font-mono font-bold"
                  >
                    {set.player1_games}
                  </div>
                ))}
              </div>
              
              {/* Current Game */}
              <div className="text-3xl font-bold font-mono">
                {score.is_tiebreak ? score.current_game.player1 : score.current_game.player1}
              </div>
            </div>
            
            {/* Center/Score Info */}
            <div className="text-center flex flex-col items-center justify-center">
              <div className="text-xl font-bold mb-2">VS</div>
              {score.is_tiebreak ? (
                <div className="text-sm bg-warning-orange bg-opacity-20 text-warning-orange px-3 py-1 rounded-full">
                  Tiebreak
                </div>
              ) : (
                score.current_game.player1 === '40' && score.current_game.player2 === '40' ? (
                  <div className="text-sm bg-accent-yellow bg-opacity-20 text-accent-yellow px-3 py-1 rounded-full">
                    Deuce
                  </div>
                ) : (
                  score.current_game.player1 === 'AD' ? (
                    <div className="text-sm bg-quantum-cyan bg-opacity-20 text-quantum-cyan px-3 py-1 rounded-full">
                      Advantage {match.player1?.username}
                    </div>
                  ) : (
                    score.current_game.player2 === 'AD' ? (
                      <div className="text-sm bg-quantum-cyan bg-opacity-20 text-quantum-cyan px-3 py-1 rounded-full">
                        Advantage {match.player2?.username}
                      </div>
                    ) : null
                  )
                )
              )}
            </div>
            
            {/* Player 2 */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="player-avatar">
                  {match.player2?.username.charAt(0).toUpperCase() || 'P2'}
                </div>
                <div className="font-bold text-lg">{match.player2?.username || 'Player 2'}</div>
                {score.server_id === match.player2_id && (
                  <div className="w-3 h-3 bg-accent-yellow rounded-full animate-pulse" title="Serving"></div>
                )}
              </div>
              
              {/* Sets */}
              <div className="flex justify-center gap-2 mb-4">
                {score.sets.map((set, index) => (
                  <div 
                    key={index} 
                    className="w-8 h-8 flex items-center justify-center bg-bg-elevated border border-border-subtle rounded-md font-mono font-bold"
                  >
                    {set.player2_games}
                  </div>
                ))}
              </div>
              
              {/* Current Game */}
              <div className="text-3xl font-bold font-mono">
                {score.is_tiebreak ? score.current_game.player2 : score.current_game.player2}
              </div>
            </div>
          </div>
        </div>

        {/* Point Type Selection */}
        <div className="bg-glass-bg backdrop-filter-blur border border-glass-border rounded-lg p-6 mb-6">
          <h3 className="text-lg font-bold mb-4">Point Type</h3>
          <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
            {(['point_won', 'ace', 'winner', 'double_fault', 'forced_error', 'unforced_error'] as PointType[]).map((type) => (
              <button
                key={type}
                onClick={() => setPointType(type)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  pointType === type 
                    ? 'bg-opacity-20 border-2' 
                    : 'bg-bg-elevated border border-border-subtle hover:bg-hover-bg'
                }`}
                style={{
                  backgroundColor: pointType === type ? `${getPointTypeColor(type)}20` : undefined,
                  borderColor: pointType === type ? getPointTypeColor(type) : undefined,
                  color: pointType === type ? getPointTypeColor(type) : 'var(--text-standard)'
                }}
              >
                {getPointTypeLabel(type)}
              </button>
            ))}
          </div>
        </div>

        {/* Point Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => handleAwardPoint(match.player1_id)}
            disabled={isSubmitting}
            className="btn btn-primary btn-lg p-6 h-auto flex flex-col items-center"
          >
            {isSubmitting ? (
              <Loader2 className="h-8 w-8 animate-spin mb-2" />
            ) : (
              <Plus className="h-8 w-8 mb-2" />
            )}
            <span className="text-lg font-bold">Point for {match.player1?.username}</span>
          </button>
          
          <button
            onClick={() => handleAwardPoint(match.player2_id)}
            disabled={isSubmitting}
            className="btn btn-primary btn-lg p-6 h-auto flex flex-col items-center"
          >
            {isSubmitting ? (
              <Loader2 className="h-8 w-8 animate-spin mb-2" />
            ) : (
              <Plus className="h-8 w-8 mb-2" />
            )}
            <span className="text-lg font-bold">Point for {match.player2?.username}</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={onBack}
            className="btn btn-ghost flex-1"
            disabled={isSubmitting}
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back
          </button>
          
          <button
            onClick={handleEndMatch}
            className="btn btn-secondary flex-1"
            disabled={isSubmitting}
          >
            <Trophy className="h-5 w-5 mr-2" />
            End Match
          </button>
        </div>

        {/* End Match Confirmation Modal */}
        {confirmEndMatch && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-glass-bg backdrop-filter-blur border border-glass-border rounded-lg p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4 flex items-center">
                <AlertTriangle className="h-6 w-6 text-warning-orange mr-2" />
                End Match Confirmation
              </h3>
              
              <p className="mb-6">
                Are you sure you want to end this match? This will mark the match as completed and calculate the final result.
              </p>
              
              <div className="flex gap-4">
                <button
                  onClick={() => setConfirmEndMatch(false)}
                  className="btn btn-ghost flex-1"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                
                <button
                  onClick={confirmMatchEnd}
                  className="btn btn-primary flex-1"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="h-5 w-5 mr-2" />
                  )}
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchScoring;