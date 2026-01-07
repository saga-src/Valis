
import React from 'react';
import { CalendarClock, AlertCircle } from 'lucide-react';
import { useTemporalProjection } from '../hooks/useTemporalProjection';
import { format } from 'date-fns';

interface TemporalProjectionWidgetProps {
  library: any[];
  sessions: any[];
}

export const TemporalProjectionWidget: React.FC<TemporalProjectionWidgetProps> = ({ library, sessions }) => {
  const { velocity, remainingGames, estimatedDate, isClear } = useTemporalProjection(library, sessions);

  return (
    <div className="bg-card border rounded-xl p-6 shadow-sm h-full flex flex-col items-center justify-center text-center relative overflow-hidden group">
       {/* Background decorative element */}
       <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
       
       <div className="mb-4 p-3 bg-primary/10 rounded-full text-primary animate-pulse-slow">
         <CalendarClock size={32} strokeWidth={1.5} />
       </div>

       {isClear ? (
         <>
            <h3 className="text-2xl font-black text-emerald-500 uppercase tracking-tight">Zero Backlog</h3>
            <p className="text-sm text-muted-foreground mt-2">You have ascended. The vault is clear.</p>
         </>
       ) : estimatedDate ? (
         <>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Estimated Completion</div>
            <h2 className="text-3xl sm:text-4xl font-black text-foreground tracking-tighter leading-none">
                {format(estimatedDate, 'MMM yyyy').toUpperCase()}
            </h2>
            <div className="mt-4 flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full border border-border/50">
               <span>Velocity: <strong className="text-primary">{velocity}</strong> games/mo</span>
               <span className="w-1 h-1 rounded-full bg-border" />
               <span>Remaining: <strong className="text-foreground">{remainingGames}</strong></span>
            </div>
         </>
       ) : (
         <>
            <h3 className="text-xl font-bold text-foreground uppercase tracking-tight flex items-center gap-2">
                <AlertCircle size={20} className="text-orange-500" /> Stagnation Detected
            </h3>
            <p className="text-xs text-muted-foreground mt-2 max-w-[200px]">
                Current velocity is 0. Beat a game to generate a projection.
            </p>
         </>
       )}
    </div>
  );
};
