
import React from 'react';
// Fix: Import Link from local shim index file to avoid casing conflict with App.tsx
import { Link } from '../../app/index';
import { Clock, Gamepad2, Quote } from 'lucide-react';
import { getCoverUrl } from '../../lib/api/igdb';
import { formatDuration } from '../../lib/utils/format';
import { Session } from './useJournal';

interface SessionEntryProps {
  session: Session & { 
    duration_seconds?: number;
    gameTitle?: string;
    gameCover?: string;
  };
}

export const SessionEntry: React.FC<SessionEntryProps> = ({ session }) => {
  const startDate = new Date(session.start_time);
  const timeString = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  // Use precise seconds if available, otherwise conversion
  const durationMs = session.duration_seconds 
    ? session.duration_seconds * 1000 
    : (session.duration_minutes || 0) * 60000;

  // Parse notes safely
  let notes: string[] = [];
  if (Array.isArray(session.notes)) {
    notes = session.notes;
  } else if (typeof session.notes === 'string') {
    try { notes = JSON.parse(session.notes); } catch { notes = []; }
  }

  return (
    <div className="flex gap-4 sm:gap-6 group relative">
      {/* Timeline Line */}
      <div className="absolute left-[3.25rem] top-0 bottom-0 w-px bg-border group-last:bottom-auto group-last:h-4" />

      {/* Time Column */}
      <div className="w-16 pt-1 text-right shrink-0">
        <span className="text-xs sm:text-sm font-mono text-muted-foreground">{timeString}</span>
      </div>

      {/* Dot on Timeline */}
      <div className="relative pt-2 shrink-0 z-10">
        <div className="w-3 h-3 rounded-full bg-muted-foreground/50 border-2 border-background group-hover:bg-primary transition-colors ring-2 ring-background" />
      </div>

      {/* Card Content */}
      <div className="flex-1 pb-8">
        <div className="bg-card border border-border/60 rounded-xl p-4 hover:border-primary/50 hover:shadow-md transition-all flex flex-col sm:flex-row items-start gap-4 group/card">
          
          {/* Cover Art */}
          <Link to={`/game/${session.game_id}`} className="shrink-0 relative overflow-hidden rounded-lg border border-border/50">
            <div className="w-16 h-20 bg-muted">
              {session.gameCover && (
                <img 
                  src={getCoverUrl(session.gameCover)} 
                  alt={session.gameTitle || 'Game Cover'} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-110" 
                />
              )}
            </div>
          </Link>

          <div className="flex-1 min-w-0 w-full">
             <div className="flex justify-between items-start gap-2">
                <Link to={`/game/${session.game_id}`} className="font-bold text-lg truncate hover:text-primary transition-colors pr-2">
                    {session.gameTitle || 'Unknown Game'}
                </Link>
                
                {/* Mood Badge */}
                {session.mood && (
                  <div className="text-xl bg-muted/30 p-1.5 rounded-lg border border-border/50 cursor-default select-none shrink-0" title="Mood">
                    {session.mood}
                  </div>
                )}
             </div>

             <div className="flex items-center gap-2 text-muted-foreground text-sm mt-1">
                <Clock size={14} />
                <span>Played for <strong className="text-foreground">{formatDuration(durationMs)}</strong></span>
             </div>

             {/* Notes / Tags */}
             {notes.length > 0 && (
               <div className="mt-3 flex flex-wrap gap-1.5">
                 {notes.map((note, idx) => (
                   <span key={idx} className="text-[10px] bg-secondary text-secondary-foreground px-2 py-0.5 rounded-md border border-border/50 font-medium">
                     {note}
                   </span>
                 ))}
               </div>
             )}

             {/* Journal Text */}
             {session.journal && (
               <div className="mt-3 text-sm text-muted-foreground italic bg-muted/20 p-3 rounded-lg border-l-2 border-primary/30 flex gap-2">
                 <Quote size={14} className="shrink-0 mt-0.5 opacity-50" />
                 <p className="line-clamp-3 group-hover/card:line-clamp-none transition-all whitespace-pre-wrap">{session.journal}</p>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};