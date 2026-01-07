import React from 'react';
import { getCoverUrl } from '../../../lib/api/igdb';
import { Layers } from 'lucide-react';
import { Link } from '../../../app/index';

interface DlcItem {
  id: string;
  name: string;
  cover_url?: string;
  game_type?: number;
}

interface DlcListProps {
  items?: DlcItem[]; // Local DB items
  dlcs?: any[]; // Fallback for IGDB raw data if needed
}

export const DlcList: React.FC<DlcListProps> = ({ items }) => {
  if (!items || !Array.isArray(items) || items.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-lg flex items-center gap-2">
        <Layers size={20} className="text-primary" /> Owned Add-ons
      </h3>
      <div className="flex overflow-x-auto gap-4 pb-4 custom-scrollbar snap-x">
        {items.map((game) => (
          <Link 
            key={game.id} 
            to={`/game/${game.id}`}
            className="w-44 shrink-0 space-y-2 group snap-start block"
          >
            <div className="aspect-[3/4] bg-muted rounded-lg overflow-hidden border border-border/50 shadow-sm relative">
                {game.cover_url ? (
                    <img 
                      src={getCoverUrl(game.cover_url, 'big')} 
                      alt={game.name}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-xs p-2 text-center">
                        No Image
                    </div>
                )}
                {/* Type Badge */}
                {(game.game_type === 1 || game.game_type === 2) && (
                    <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[8px] font-black uppercase text-white border border-white/10">
                        {game.game_type === 2 ? 'EXP' : 'DLC'}
                    </div>
                )}
            </div>
            <p className="text-sm font-bold leading-tight line-clamp-2 group-hover:text-primary transition-colors" title={game.name}>
                {game.name}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
};