import React from 'react';
// Fix: Import useNavigate from local shim index file to avoid casing conflict with App.tsx
import { useNavigate } from '../../../app/index';
import { ArrowLeft, Share2, Edit, Trash2, Play } from 'lucide-react';

interface GameActionsProps {
  gameId: string;
  onShare: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const GameActions: React.FC<GameActionsProps> = ({ gameId, onShare, onEdit, onDelete }) => {
  const navigate = useNavigate();

  return (
    <div className="absolute top-6 left-6 right-6 flex justify-between items-start z-50 pointer-events-none">
      {/* Back Button */}
      <button 
        onClick={() => navigate(-1)} 
        className="pointer-events-auto p-2 rounded-full bg-background/50 backdrop-blur hover:bg-background transition-colors shadow-sm border border-white/5"
      >
        <ArrowLeft size={20} />
      </button>

      {/* Action Buttons */}
      <div className="flex gap-2 pointer-events-auto">
        <button 
          onClick={onShare}
          className="p-2 rounded-full bg-background/50 backdrop-blur hover:bg-background transition-colors shadow-sm border border-white/5" 
          title="Share"
        >
          <Share2 size={18} />
        </button>
        <button 
          id="btn-quick-play"
          onClick={() => navigate('/play', { state: { gameId } })}
          className="p-2 rounded-full bg-primary text-primary-foreground hover:brightness-110 transition-all shadow-sm border border-white/10" 
          title="Start Manual Session"
        >
          <Play size={18} fill="currentColor" className="ml-0.5" />
        </button>
        <button 
          id="btn-edit-game"
          onClick={onEdit}
          className="p-2 rounded-full bg-background/50 backdrop-blur hover:bg-background transition-colors shadow-sm border border-white/5" 
          title="Edit Game"
        >
          <Edit size={18} />
        </button>
        <button 
          onClick={onDelete}
          className="p-2 rounded-full bg-destructive/80 text-white backdrop-blur hover:bg-destructive transition-colors shadow-sm border border-white/5" 
          title="Remove Game"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
};