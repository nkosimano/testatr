import React from 'react';
import { Calendar, MapPin, Trophy, Clock, Target } from 'lucide-react';
import { Match } from '../types';
import MatchRequestActions from './matches/MatchRequestActions';

interface MatchCardProps {
  match: Match;
  currentUserId: string;
  onReportScore: () => void;
  onViewDetails?: (() => void) | undefined;
  onActionComplete?: () => void;
}

const MatchCard: React.FC<MatchCardProps> = ({
  match,
  currentUserId,
  onReportScore,
  onViewDetails,
  onActionComplete = () => {}
}) => {
  // Determine which player is the opponent based on the current user ID
  const isChallenger = match.challengerId === currentUserId;
  const opponentProfile = isChallenger ? match.player2 : match.player1;
  
  const matchDate = new Date(match.date);
  const isCompleted = match.status === 'completed';
  
  const getStatusColor = (status: Match['status']) => {
    switch (status) {
      case 'pending':
        return 'var(--warning-orange)';
      case 'confirmed':
        return 'var(--quantum-cyan)';
      case 'completed':
        return 'var(--success-green)';
      case 'declined':
        return 'var(--error-pink)';
      default:
        return 'var(--text-muted)';
    }
  };

  const getStatusText = (status: Match['status']) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'confirmed':
        return 'Confirmed';
      case 'completed':
        return 'Completed';
      case 'declined':
        return 'Declined';
      default:
        return status;
    }
  };

  // Format score for display
  const getFormattedScore = () => {
    if (typeof match.score === 'string') {
      return match.score;
    } else if (match.score && typeof match.score === 'object') {
      // For JSONB score objects, format sets
      try {
        const sets = match.score.sets || [];
        if (sets.length === 0) return 'No sets played';
        
        return sets.map((set: any) => 
          `${set.player1_games}-${set.player2_games}`
        ).join(', ');
      } catch (err) {
        console.error('Error formatting score:', err);
        return 'Score unavailable';
      }
    }
    return '';
  };
  if (!opponentProfile) {
    return null;
  }

  return (
    <div className="card" onClick={onViewDetails ? () => onViewDetails() : undefined} style={{ cursor: onViewDetails ? 'pointer' : 'default' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="player-avatar text-sm">
            {opponentProfile.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold" style={{ color: 'var(--text-standard)' }}>
              vs {opponentProfile.username}
            </h3>
            <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
              {isChallenger ? 'You challenged' : 'Challenged you'}
            </p>
          </div>
        </div>
        <div 
          className="px-3 py-1 rounded-full text-xs font-medium"
          style={{ 
            backgroundColor: `${getStatusColor(match.status)}20`,
            color: getStatusColor(match.status)
          }}
        >
          {getStatusText(match.status)}
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-subtle)' }}>
          <Calendar size={14} />
          <span>{matchDate.toLocaleDateString()} at {matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-subtle)' }}>
          <MapPin size={14} />
          <span>{match.location}</span>
        </div>
      </div>

      {isCompleted && match.challengerScore !== undefined && match.challengedScore !== undefined && (
        <div className="border-t pt-4 mb-4" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center justify-between">
            <div className="text-sm" style={{ color: 'var(--text-subtle)' }}>Final Score:</div> 
            <div className="font-mono font-bold" style={{ color: 'var(--text-standard)' }}>
              {isChallenger 
                ? (match.challengerScore && match.challengedScore 
                   ? `${match.challengerScore} - ${match.challengedScore}` 
                   : getFormattedScore())
                : (match.challengedScore && match.challengerScore 
                   ? `${match.challengedScore} - ${match.challengerScore}` 
                   : getFormattedScore())
              }
            </div>
          </div>
          {match.winner && (
            <div className="text-center mt-2">
              <span 
                className="inline-flex items-center gap-1 text-sm font-medium"
                style={{ color: match.winner === currentUserId ? 'var(--success-green)' : 'var(--error-pink)' }}
              >
                <Trophy size={14} />
                {match.winner === currentUserId ? 'You Won!' : 'You Lost'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Show report score button for the challenger if match is pending */}
      {/* Show report score button for confirmed or in_progress matches */}
      {(match.status === 'pending' || match.status === 'in_progress' || match.status === 'confirmed') && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onReportScore();
          }}
          className="btn btn-secondary btn-glare w-full"
        >
          <Target size={16} />
          Report Score
        </button>
      )}
      
      {/* Show accept/decline buttons for the challenged player if match is pending */}
      {match.status === 'pending' && !isChallenger && (
        <MatchRequestActions 
          match={match} 
          onActionComplete={onActionComplete} 
        />
      )}
      
      {!isCompleted && match.status !== 'pending' && onViewDetails && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onViewDetails) onViewDetails();
          }}
          className="btn btn-secondary btn-glare w-full"
        >
          View Details
        </button>
      )}
    </div>
  );
};

export default MatchCard;