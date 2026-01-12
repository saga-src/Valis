import React from 'react';
import { Clock } from 'lucide-react';

interface IngestionStepProps {
  onLinkLater?: () => void;
}

export const IngestionStep: React.FC<IngestionStepProps> = ({ onLinkLater }) => {
  const handleLinkLaterAction = () => {
    console.log('[TourSpy] Link Later triggered inside IngestionStep');
    if (typeof onLinkLater === 'function') {
      onLinkLater();
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-muted/20 border border-dashed border-border rounded-xl text-center">
        <p className="text-[10px] font-medium text-muted-foreground leading-relaxed uppercase tracking-wider">
          The spotlight is highlighting the connection controls on the page.
        </p>
      </div>

      <button
        id="tour-link-later"
        onClick={handleLinkLaterAction}
        className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all border border-white/5 flex items-center justify-center gap-2"
      >
        <Clock size={14} /> Link Later
      </button>
    </div>
  );
};