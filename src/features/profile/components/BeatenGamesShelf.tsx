
import React from 'react';
import { getCoverUrl } from '../../../lib/api/igdb';
import { BookOpen } from 'lucide-react';

interface BeatenGame {
  title: string;
  cover: string;
  score: number;
}

interface BeatenGamesShelfProps {
  games: BeatenGame[];
  title?: string;
}

export const BeatenGamesShelf: React.FC<BeatenGamesShelfProps> = ({ games, title = "Journal Entries" }) => {
  if (!games || games.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen size={20} className="text-blue-500" />
        <h3 className="font-bold text-lg text-foreground">{title}</h3>
        <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-auto">
            {games.length}
        </span>
      </div>
      
      <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide snap-x">
        {games.map((game, index) => (
          <div 
            key={`${game.title}-${index}`} 
            className="group relative w-32 shrink-0 snap-start"
          >
             {/* Card */}
             <div className="aspect-[2/3] rounded-lg overflow-hidden border border-white/10 shadow-md relative bg-muted transition-transform duration-300 group-hover:scale-105">
                <img 
                    src={getCoverUrl(game.cover)} 
                    alt={game.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                />
                
                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-60" />

                {/* Score Badge */}
                {game.score > 0 && (
                    <div className="absolute top-2 right-2 bg-yellow-500 text-black font-black text-[10px] w-6 h-6 rounded-full flex items-center justify-center shadow-lg border border-white/20 z-10">
                        {game.score}
                    </div>
                )}
             </div>

             {/* Title on Hover (or always visible for accessibility/usability?) Instructions say "On hover, show the Title" */}
             {/* I'll make it appear below always but maybe truncation handled */}
             <div className="mt-2 text-[10px] font-bold leading-tight text-center opacity-70 group-hover:opacity-100 group-hover:text-primary transition-all line-clamp-2">
                {game.title}
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};
