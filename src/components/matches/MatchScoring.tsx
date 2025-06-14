import React, { useState, useEffect, useRef } from 'react';
import { 
  Trophy, 
  Plus, 
  Loader2, 
  AlertTriangle,
  CheckCircle,
  ArrowLeft,
  RotateCcw,
  Target,
  Award,
  Clock
} from 'lucide-react';
import LoadingSpinner from '../LoadingSpinner';
import { useMatchMutations } from '../../hooks/useMatchMutations';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
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

interface MatchScoreHistory {
  score: TennisScore;
  timestamp: number;
  action: string;
  pointWinner: string;
  pointType: string;
}

export const MatchScoring: React.FC<MatchScoringProps> = ({ match, onBack }) => {
  const { user } = useAuthStore();
  const [score, setScore] = useState<TennisScore | null>(null);
  const [pointType, setPointType] = useState<PointType>('point_won');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmEndMatch, setConfirmEndMatch] = useState(false);
  const [lastPointPlayerId, setLastPointPlayerId] = useState<string | null>(null);
  const [scoreHistory, setScoreHistory] = useState<MatchScoreHistory[]>([]);
  const scoreRef = useRef<TennisScore | null>(null);

  const { awardPoint, updateMatch } = useMatchMutations(user?.id ?? '');

  useEffect(() => {
    const initializeScore = () => {
      if (match && match.score) {
        try {
          const parsedScore = typeof match.score === 'string' ? JSON.parse(match.score) : match.score;
          setScore(parsedScore);
          scoreRef.current = parsedScore;
        } catch (err) {
          console.error('Error parsing score:', err);
          setError('Error loading match score');
        }
      } else {
        const defaultScore = {
          sets: [],
          current_game: { player1: '0', player2: '0' },
          server_id: match.player1_id,
          is_tiebreak: false,
        };
        setScore(defaultScore);
        scoreRef.current = defaultScore;
      }
    };

    initializeScore();

    const subscription = supabase
      .channel(`match-${match.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${match.id}`,
        },
        (payload) => {
          if (payload.new && payload.new.score) {
            const newScore = payload.new.score as TennisScore;
            setScore(newScore);
            scoreRef.current = newScore;

            if (payload.new.status === 'completed') {
              setSuccessMessage('Match completed!');
              setTimeout(() => onBack(), 3000);
            }
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [match.id, match.player1_id, onBack]);

  useEffect(() => {
    if (score) {
      setPointType('point_won');
      scoreRef.current = score;
    }
  }, [score]);

  const handleAwardPoint = async (playerId: string) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Save current score to history before updating
      if (scoreRef.current) {
        const historyEntry: MatchScoreHistory = {
          score: JSON.parse(JSON.stringify(scoreRef.current)), // Deep copy
          timestamp: Date.now(),
          action: 'point_awarded',
          pointWinner: playerId,
          pointType: pointType
        };
        setScoreHistory(prev => [historyEntry, ...prev]);
      }

      await awardPoint.mutateAsync({
        matchId: match.id,
        winningPlayerId: playerId,
        pointType: pointType,
      });
      setLastPointPlayerId(playerId);
      setTimeout(() => setLastPointPlayerId(null), 2000);
    } catch (err: any) {
      console.error('Error awarding point:', err);
      setError(err.message || 'Failed to award point');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUndoLastPoint = () => {
    if (scoreHistory.length === 0 || isSubmitting) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Get the last score from history
      const lastScoreEntry = scoreHistory[0];
      
      // Update the match with the previous score
      supabase
        .from('matches')
        .update({ score: lastScoreEntry.score })
        .eq('id', match.id)
        .then(({ error }) => {
          if (error) throw error;
          
          // Remove the entry from history
          setScoreHistory(prev => prev.slice(1));
          setSuccessMessage('Last point undone');
          setTimeout(() => setSuccessMessage(null), 2000);
        })
        .catch(error => {
          throw error;
        });
    } catch (err: any) {
      console.error('Error undoing last point:', err);
      setError(err.message || 'Failed to undo last point');
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
      await updateMatch.mutateAsync({
        id: match.id,
        updates: {
          status: 'completed',
          winner_id: getMatchWinner(),
        },
      });

      setSuccessMessage('Match completed successfully!');
      setTimeout(() => {
        onBack();
      }, 3000);
    } catch (err: any) {
      console.error('Error ending match:', err);
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
    
    let player1SetsWon = 0;
    let player2SetsWon = 0;

    score.sets.forEach(set => {
      if (set.player1_games > set.player2_games) {
        player1SetsWon++;
      } else if (set.player2_games > set.player1_games) {
        player2SetsWon++;
      }
    });

    // Assuming a best-of-3 match for now
    if (player1SetsWon >= 2) return match.player1_id;
    if (player2SetsWon >= 2) return match.player2_id;

    return ''; // No winner yet
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

  // Format the score for display
  const getFormattedSets = () => {
    if (!score || !score.sets) return [];
    
    return score.sets.map(set => ({
      player1: set.player1_games,
      player2: set.player2_games
    }));
  };

  // Get the current game score
  const getCurrentGameScore = () => {
    if (!score) return { player1: '0', player2: '0' };
    return score.current_game;
  };

  // Get the current set number
  const getCurrentSetNumber = () => {
    if (!score || !score.sets) return 1;
    return score.sets.length + 1;
  };

  // Check if a player is serving
  const isServing = (playerId: string) => {
    if (!score) return false;
    return score.server_id === playerId;
  };

  if (!score) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="large" text="Loading match data..." />
      </div>
    );
  }

  const formattedSets = getFormattedSets();
  const currentGameScore = getCurrentGameScore();
  const currentSetNumber = getCurrentSetNumber();

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
            {score.is_tiebreak ? 'Tiebreak' : `Set ${currentSetNumber}`}
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

        {/* Undo Button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={handleUndoLastPoint}
            disabled={isSubmitting || scoreHistory.length === 0}
            className="undo-button"
          >
            <RotateCcw className="h-5 w-5 mr-2" />
            Undo Last Point
          </button>
        </div>

        {/* Enhanced Score Display */}
        <div className="score-display">
          <h3 className="score-display-title">Current Score</h3>
          <div className="score-display-content">
            <div className="score-display-player">
              <div className="flex items-center">
                <span className="score-display-name">{match.player1?.username}</span>
                {isServing(match.player1_id) && <div className="score-display-serving"></div>}
              </div>
              <div className={`score-display-points ${lastPointPlayerId === match.player1_id ? 'text-success-green scale-110' : ''}`}>
                {currentGameScore.player1}
              </div>
              <div className="score-display-sets">
                {formattedSets.map((set, index) => (
                  <div key={index} className="score-display-set">{set.player1}</div>
                ))}
              </div>
            </div>
            
            <div className="score-display-vs">VS</div>
            
            <div className="score-display-player">
              <div className="flex items-center">
                <span className="score-display-name">{match.player2?.username}</span>
                {isServing(match.player2_id) && <div className="score-display-serving"></div>}
              </div>
              <div className={`score-display-points ${lastPointPlayerId === match.player2_id ? 'text-success-green scale-110' : ''}`}>
                {currentGameScore.player2}
              </div>
              <div className="score-display-sets">
                {formattedSets.map((set, index) => (
                  <div key={index} className="score-display-set">{set.player2}</div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Game Status */}
          {score.is_tiebreak ? (
            <div className="mt-4 text-sm bg-warning-orange bg-opacity-20 text-warning-orange px-3 py-1 rounded-full inline-block">
              Tiebreak
            </div>
          ) : (
            currentGameScore.player1 === '40' && currentGameScore.player2 === '40' ? (
              <div className="mt-4 text-sm bg-accent-yellow bg-opacity-20 text-accent-yellow px-3 py-1 rounded-full inline-block">
                Deuce
              </div>
            ) : (
              currentGameScore.player1 === 'AD' ? (
                <div className="mt-4 text-sm bg-quantum-cyan bg-opacity-20 text-quantum-cyan px-3 py-1 rounded-full inline-block">
                  Advantage {match.player1?.username}
                </div>
              ) : (
                currentGameScore.player2 === 'AD' ? (
                  <div className="mt-4 text-sm bg-quantum-cyan bg-opacity-20 text-quantum-cyan px-3 py-1 rounded-full inline-block">
                    Advantage {match.player2?.username}
                  </div>
                ) : null
              )
            )
          )}
        </div>

        {/* Point History */}
        {scoreHistory.length > 0 && (
          <div className="point-history">
            <h3 className="point-history-title">Recent Points</h3>
            <div className="point-history-list">
              {scoreHistory.slice(0, 5).map((entry, index) => {
                const playerName = entry.pointWinner === match.player1_id 
                  ? match.player1?.username 
                  : match.player2?.username;
                
                return (
                  <div key={index} className="point-history-item">
                    <div>
                      <span className="point-history-player">{playerName}</span>
                      <span className="point-history-type"> - {getPointTypeLabel(entry.pointType as PointType)}</span>
                    </div>
                    <span className="point-history-time">
                      {new Date(entry.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
          <Link
            to="/matches"
            className="btn btn-ghost flex-1"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Matches
          </Link>
          
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