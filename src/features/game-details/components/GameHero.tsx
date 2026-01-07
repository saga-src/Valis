import React from 'react';
import { Calendar, Star, Clock } from 'lucide-react';
import { getCoverUrl } from '../../../lib/api/igdb';
import { formatPlaytime, getTotalPlaytimeSeconds } from '../../../lib/utils/format';
import { useGameMetadata } from '../hooks/useGameMetadata';

interface GameHeroProps {
  game: any;
  children?: React.ReactNode; 
}

export const GameHero: React.FC<GameHeroProps> = ({ game, children }) => {
  const metadata = useGameMetadata(game);
  
  // Total Playtime Calculation using global helper
  const totalSeconds = getTotalPlaytimeSeconds(game);

  return (
    <div className="relative h-[400px] w-full shrink-0 group">
      <div className="absolute inset-0 bg-muted z-0">
        {game.backdrop_url ? (
           <img src={game.backdrop_url} className="w-full h-full object-cover opacity-60 mask-image-gradient" alt="Backdrop" />
        ) : (
           <div className="w-full h-full bg-gradient-to-b from-primary/20 to-background" />
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent z-10" />
      
      {children}

      <div className="absolute bottom-0 left-0 right-0 z-20">
         <div className="max-w-[1600px] mx-auto px-10 pb-10 flex items-end gap-8">
            <img 
              src={getCoverUrl(game.cover_url, 'big')} 
              className="w-32 md:w-48 rounded-lg shadow-2xl border-4 border-background/50 object-cover shadow-black/50 backdrop-blur-sm" 
              alt={game.name}
            />
            <div className="mb-2 space-y-2 flex-1 min-w-0">
              <h1 className="text-3xl md:text-5xl font-black tracking-tight text-foreground line-clamp-2 drop-shadow-md">
                  {game.name}
              </h1>
              <div className="flex flex-wrap items-center gap-6 text-sm font-medium text-muted-foreground/80">
                  {metadata?.developers && (
                      <span className="text-foreground font-semibold">{metadata.developers}</span>
                  )}
                  {game.first_release_date && (
                    <span className="flex items-center gap-1.5">
                        <Calendar size={14} /> 
                        {new Date(game.first_release_date * 1000).getFullYear()}
                    </span>
                  )}
                  
                  {game.final_score ? (
                    <span className="flex items-center gap-1.5 text-yellow-500 font-bold bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
                        <Star size={14} fill="currentColor" /> {game.final_score} 
                        <span className="text-[10px] opacity-70 uppercase tracking-wide ml-0.5">My Score</span>
                    </span>
                  ) : (
                      <span className="flex items-center gap-1.5 text-muted-foreground opacity-60">
                        <Star size={14} /> <span className="text-xs">Unrated</span>
                    </span>
                  )}

                  {/* Enhanced Playtime Display */}
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest flex items-center gap-1">
                      <Clock size={10} /> Total Time
                    </span>
                    <span className="text-xl font-black italic text-foreground leading-none mt-1">
                      {formatPlaytime(totalSeconds)}
                    </span>
                  </div>
              </div>
            </div>
         </div>
      </div>
    </div>
  );
};