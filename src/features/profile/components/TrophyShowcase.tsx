
import React from 'react';
import { Trophy, Star } from 'lucide-react';
import { getCoverUrl } from '../../../lib/api/igdb';

interface ShowcaseItem {
  id: string;
  title: string;
  cover_url: string;
  rating?: number;
}

interface TrophyShowcaseProps {
  games: ShowcaseItem[];
  onGameClick?: (id: string) => void;
  title?: string;
}

export const TrophyShowcase: React.FC<TrophyShowcaseProps> = ({ games, onGameClick, title = "Completed Games" }) => {
  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Trophy size={20} className="text-yellow-500 fill-yellow-500/20" />
        <h3 className="font-bold text-lg text-foreground">{title}</h3>
        <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-auto">
            {games.length}
        </span>
      </div>

      {games.length === 0 ? (
        <div className="h-32 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border/50 rounded-xl bg-muted/5">
            <Trophy size={32} className="opacity-20 mb-2" />
            <p className="text-sm font-medium">No perfect games yet.</p>
        </div>
      ) : (
        <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide snap-x">
            {games.map((game) => (
            <button
                key={game.id}
                onClick={() => onGameClick?.(game.id)}
                className="group relative w-32 shrink-0 snap-start aspect-[2/3] rounded-lg overflow-hidden border border-yellow-500/30 shadow-lg shadow-yellow-500/5 transition-all duration-300 hover:scale-105"
                title={game.title}
            >
                {/* Image */}
                <img 
                    src={getCoverUrl(game.cover_url, 'big')} 
                    alt={game.title} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                    loading="lazy"
                />
                
                {/* Gold Shine Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-yellow-900/60 via-transparent to-transparent opacity-60" />
                
                {/* Badge Overlay */}
                <div className="absolute top-2 right-2">
                    <div className="bg-black/80 backdrop-blur-sm border border-yellow-500/50 p-1.5 rounded-full text-yellow-500 shadow-xl">
                        <Trophy size={12} fill="currentColor" />
                    </div>
                </div>

                {/* Footer Rating (Optional) */}
                {game.rating !== undefined && (
                    <div className="absolute bottom-0 left-0 right-0 p-2 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/90 to-transparent">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-yellow-400">
                            <Star size={10} fill="currentColor" /> {game.rating.toFixed(1)}
                        </div>
                    </div>
                )}
            </button>
            ))}
        </div>
      )}
    </div>
  );
};
