
import React from 'react';
// Fix: Import Link from local shim index file to avoid casing conflict with App.tsx
import { Link } from '../../../app/index';
import { Clock, Star, Play, Info } from 'lucide-react';
import { getCoverUrl } from '../../../lib/api/igdb';
import { formatPlaytime } from '../../../lib/utils/format';
import { cn } from '../../../lib/utils/cn';
import { LibrarySettings } from '../hooks/useLibrarySettings';
import { getStatusColorVar } from '../utils/libraryUtils';

interface GameListRowProps {
  game: any;
  settings: LibrarySettings;
  playtime?: number; // Legacy
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
    return <span className="font-mono mr-1.5">{icons[status] || '•'}</span>;
  }
  return null;
};

export const GameListRow: React.FC<GameListRowProps> = ({ game, settings, libraryAction, theme }) => {
  const primaryPath = libraryAction === 'details' ? `/game/${game.id}` : `/play`;
  const linkState = libraryAction === 'play' ? { gameId: game.id } : undefined;
  const isStealth = theme === 'stealth';
  
  const releaseYear = game.first_release_date ? new Date(game.first_release_date * 1000).getFullYear() : 'TBA';

  const genres = (() => {
      try {
          const g = JSON.parse(game.genres || '[]');
          return g.map((gen: any) => gen.name).join(', ');
      } catch { return ''; }
  })();

  const platforms = (() => {
      try {
          const p = JSON.parse(game.platforms || '[]');
          return p.map((plat: any) => plat.abbreviation || plat.name).join(', ');
      } catch { return ''; }
  })();

  // Total = Session + Legacy
  const displaySeconds = (game.playtime_seconds || 0) + (game.legacy_playtime_seconds || 0);
  const statusColor = getStatusColorVar(game.status);

  return (
    <Link 
      to={primaryPath}
      state={linkState}
      className="group flex items-center gap-4 p-2 rounded-lg hover:bg-card border border-transparent hover:border-border/50 transition-all hover:shadow-sm"
    >
      <div className="w-12 h-16 shrink-0 rounded-md overflow-hidden bg-muted relative border border-white/10">
        <img 
            src={getCoverUrl(game.cover_url, 'big')} 
            alt={game.name} 
            className={cn(
                "w-full h-full object-cover transition-all",
                isStealth && "opacity-60 grayscale group-hover:opacity-100 group-hover:grayscale-0"
            )}
            loading="lazy" 
        />
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center gap-2">
            <h3 className="font-display font-bold text-foreground truncate group-hover:text-primary transition-colors text-sm md:text-base tracking-tight">
                {game.name}
            </h3>
            {(game.game_type === 1 || game.game_type === 2) && (
                <span className="text-[10px] px-1.5 rounded bg-purple-600/20 text-purple-500 font-black border border-purple-600/20 uppercase tracking-tighter">
                    {game.game_type === 2 ? 'EXPANSION' : 'DLC'}
                </span>
            )}
        </div>
        
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 truncate">
           <span 
               style={{ 
                   color: isStealth ? 'var(--muted-foreground)' : statusColor,
                   backgroundColor: isStealth ? 'transparent' : `${statusColor}15`
               }}
               className={cn(
                 "px-1.5 py-0.5 rounded-[3px] text-[10px] font-bold uppercase tracking-wider border border-transparent flex items-center",
                 isStealth && "bg-white/5 border-white/10"
               )}
           >
               {getStatusIndicator(game.status, isStealth)}
               {game.status}
           </span>
           <span>•</span>
           <span className="truncate">{genres || platforms || releaseYear}</span>
        </div>
      </div>

      <div className="flex items-center gap-6 text-sm text-muted-foreground">
          {settings.showRating && (
            <div className={cn("w-16 text-right font-mono font-bold flex items-center justify-end gap-1.5", game.final_score ? "text-yellow-500" : "opacity-30")}>
               <Star size={14} className={game.final_score ? "fill-yellow-500" : ""} /> 
               {game.final_score || '-'}
            </div>
          )}

          {settings.showTime && (
            <div className="w-20 text-right font-mono flex items-center justify-end gap-1.5">
               {displaySeconds > 0 ? (
                   <>
                    <Clock size={14} /> {formatPlaytime(displaySeconds)}
                   </>
               ) : (
                   <span className="opacity-30">-</span>
               )}
            </div>
          )}
          
          <div className="w-16 text-right hidden sm:block font-mono font-bold">
              {releaseYear}
          </div>
      </div>
      
      <div className="w-10 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
         <div className="p-2 rounded-full bg-primary text-primary-foreground hover:scale-110 transition-transform shadow-md">
            {libraryAction === 'details' ? <Play size={14} fill="currentColor" className="ml-0.5" /> : <Info size={14} />}
         </div>
      </div>
    </Link>
  );
};