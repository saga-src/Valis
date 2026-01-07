
import React from 'react';
// Fix: Import Link and useNavigate from local shim index file to avoid casing conflict with App.tsx
import { Link, useNavigate } from '../../../app/index';
import { Play, Info, Star, Globe } from 'lucide-react';
import { formatCardTime, getTotalPlaytimeSeconds } from '../../../lib/utils/format';
import { cn } from '../../../lib/utils/cn';
import { LibrarySettings } from '../hooks/useLibrarySettings';
import { getStatusColorVar } from '../utils/libraryUtils';
import { useSettings } from '../../settings/useSettings';
import { useMarkObserver } from '../../gamification/hooks/useMarkObserver';

interface GameCardProps {
  game: any;
  settings: LibrarySettings;
  playtime?: number; // Legacy prop
  libraryAction: 'details' | 'play';
  theme: string;
}

const getStatusIndicator = (status: string, isStealth: boolean) => {
  if (isStealth) {
    const icons: Record<string, string> = {
      'Playing': '●',
      'Backlog': '○',
      'Completed': '✓',
      'Dropped': '×'
    };
    return <span className="text-zinc-400 font-mono text-[10px] leading-none">{icons[status] || '•'}</span>;
  }

  return <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_5px_rgba(255,255,255,0.8)]" />;
};

export const GameCard: React.FC<GameCardProps> = ({ 
    game, 
    settings, 
    libraryAction, 
    theme 
}) => {
  const navigate = useNavigate();
  const { museumMode } = useSettings();
  const { reportSignal } = useMarkObserver();

  const primaryPath = libraryAction === 'details' ? `/game/${game.id}` : `/play`;
  const linkState = libraryAction === 'play' ? { gameId: game.id } : undefined;
  
  const totalSeconds = getTotalPlaytimeSeconds(game);
  const statusColor = getStatusColorVar(game.status);
  const isStealth = theme === 'stealth';
  const releaseYear = game.first_release_date 
    ? new Date(game.first_release_date * 1000).getFullYear() 
    : '----';

  const handleClick = () => {
    reportSignal('GAME_CARD_CLICK', game.id);
  };

  // --- RATING LOGIC ---
  // Prioritize user_rating (or final_score as fallback for detailed reviews), then global rating
  const userScore = game.user_rating ?? game.final_score;
  const globalScore = Math.round(game.rating || 0);

  const hasUserScore = typeof userScore === 'number' && userScore > 0;
  const hasGlobalScore = globalScore > 0;
  
  const showBadge = settings.showRating && (hasUserScore || hasGlobalScore);

  return (
    <Link
      to={primaryPath}
      state={linkState}
      onClick={handleClick}
      className={cn(
        "group relative flex flex-col overflow-hidden transition-all duration-300 h-full border text-card-foreground",
        "border-border/40 hover:border-primary/50 bg-background hover:shadow-xl",
        museumMode ? "rounded-none museum-card" : "rounded-xl"
      )}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
        <img
          src={game.cover_url}
          alt={game.name}
          className="h-full w-full object-cover transition-all duration-700 ease-out group-hover:scale-110"
          loading="lazy"
        />
        
        {/* ⚡ High-Visibility Refractive Layer (Museum Mode) */}
        {museumMode && (
          <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/25 to-white/0 opacity-60 transform -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
            <div className="absolute inset-0 border-[0.5px] border-white/20" />
          </div>
        )}
        
        {/* Glossy reflection effect (Legacy/Default) */}
        {!museumMode && <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-white/5 opacity-40 pointer-events-none" />}
        
        <div 
          style={!isStealth ? { backgroundColor: statusColor } : {}}
          className={cn(
            "absolute top-2 right-2 px-1.5 py-0.5 flex items-center gap-1.5 z-20 transition-all pointer-events-none",
            isStealth 
              ? "bg-transparent border border-zinc-700 text-zinc-500 rounded-none uppercase tracking-tighter font-bold text-[10px] px-2 py-1" 
              : (museumMode ? "rounded-none border-white/20 uppercase tracking-widest text-[8px] valis-glass" : "rounded-md border-white/10 valis-glass shadow-sm")
          )}
        >
          {!museumMode && !isStealth && getStatusIndicator(game.status, isStealth)}
          <span className={cn(
            "font-black uppercase tracking-tighter", 
            isStealth ? "text-zinc-500" : "text-white",
            museumMode && !isStealth ? "text-[8px]" : "text-[9px]"
          )}>
            {game.status}
          </span>
        </div>
        
        <div className="absolute top-2 left-2 flex flex-col gap-1 items-start z-20 pointer-events-none">
            {showBadge && (
                <div className={cn(
                    "flex items-center justify-center gap-1.5 px-2 h-6 shadow-md backdrop-blur-md border transition-all",
                    museumMode ? "rounded-none bg-white/10 border-white/20" : "rounded-md valis-glass",
                    !museumMode && (hasUserScore 
                        ? "bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-amber-900/20" 
                        : "bg-black/60 border-white/10 text-white")
                )}>
                    {hasUserScore ? (
                        <Star size={12} fill="currentColor" />
                    ) : (
                        <Globe size={12} />
                    )}
                    <span className="text-[11px] font-mono font-black tracking-tight -mt-0.5">
                        {hasUserScore 
                            ? Number(userScore).toFixed(1) 
                            : globalScore
                        }
                    </span>
                </div>
            )}

            {(game.game_type === 1 || game.game_type === 2) && (
                <div className={cn(
                  "valis-glass px-1.5 py-0.5 text-[9px] font-black text-white backdrop-blur-md border border-white/10 shadow-sm uppercase tracking-tighter",
                  museumMode ? "rounded-none" : "rounded-md"
                )}>
                    {game.game_type === 2 ? 'EXT' : 'DLC'}
                </div>
            )}
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end justify-between p-3 pointer-events-none z-10">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const target = libraryAction === 'details' ? '/play' : `/game/${game.id}`;
              const state = libraryAction === 'details' ? { gameId: game.id } : undefined;
              navigate(target, { state });
            }}
            className={cn(
              "pointer-events-auto transform translate-y-4 group-hover:translate-y-0 h-9 w-9 bg-primary text-primary-foreground shadow-2xl transition-all duration-300 hover:scale-110 active:scale-90 flex items-center justify-center border border-white/20",
              museumMode ? "rounded-none" : "rounded-full"
            )}
            title={libraryAction === 'details' ? "Play" : "View Details"}
          >
            {libraryAction === 'details' ? (
                <Play size={18} fill="currentColor" className="text-white ml-0.5" />
            ) : (
                <Info size={20} strokeWidth={2.5} />
            )}
          </button>
        </div>
      </div>

      <div className={cn(
        "flex flex-1 flex-col p-3 gap-2 transition-colors duration-300",
        "bg-background"
      )}>
        <h3 className={cn(
          "line-clamp-1 font-bold leading-tight text-xs md:text-sm", 
          "text-foreground",
          museumMode && "font-display tracking-tight"
        )} title={game.name}>
          {game.name}
        </h3>
        
        <div className={cn(
          "mt-auto flex items-center justify-between gap-2 text-xs min-h-[16px]",
          "text-muted-foreground",
          museumMode && "font-telemetry text-foreground/60"
        )}>
            <span className="font-bold shrink-0">
                {releaseYear}
            </span>

            {settings.showTime && totalSeconds > 0 && (
                <span className="font-mono">
                    {formatCardTime(totalSeconds)}
                </span>
            )}
        </div>
      </div>
    </Link>
  );
};
