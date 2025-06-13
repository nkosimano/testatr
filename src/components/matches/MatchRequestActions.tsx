import React, { useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Match } from '../../types';

interface MatchRequestActionsProps {
  match: Match;
  onActionComplete: () => void;
}

const MatchRequestActions: React.FC<MatchRequestActionsProps> = ({ match, onActionComplete }) => {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      const { error } = await supabase
        .from('matches')
        .update({ status: 'in_progress' })
        .eq('id', match.id);

      if (error) throw error;
      onActionComplete();
    } catch (error) {
      console.error('Error accepting match:', error);
      alert('Failed to accept match. Please try again.');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    setIsDeclining(true);
    try {
      const { error } = await supabase
        .from('matches')
        .update({ status: 'cancelled' })
        .eq('id', match.id);

      if (error) throw error;
      onActionComplete();
    } catch (error) {
      console.error('Error declining match:', error);
      alert('Failed to decline match. Please try again.');
    } finally {
      setIsDeclining(false);
    }
  };

  return (
    <div className="flex gap-2 mt-4">
      <button
        onClick={handleAccept}
        disabled={isAccepting || isDeclining}
        className="btn btn-primary flex-1"
      >
        {isAccepting ? (
          <>
            <Loader2 size={16} className="animate-spin mr-2" />
            Accepting...
          </>
        ) : (
          <>
            <Check size={16} className="mr-2" />
            Accept Match
          </>
        )}
      </button>
      
      <button
        onClick={handleDecline}
        disabled={isAccepting || isDeclining}
        className="btn btn-ghost flex-1"
      >
        {isDeclining ? (
          <>
            <Loader2 size={16} className="animate-spin mr-2" />
            Declining...
          </>
        ) : (
          <>
            <X size={16} className="mr-2" />
            Decline
          </>
        )}
      </button>
    </div>
  );
};

export default MatchRequestActions;