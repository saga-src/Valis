
import React from 'react';
import { Database } from 'lucide-react';
import { CUSTOM_PLATFORM_DATA } from '../../../types/index';
import { useGameMetadata } from '../hooks/useGameMetadata';
import { PlatformIcon } from '../../../components/ui/PlatformIcon';

interface GameMetadataProps {
  game: any;
  metadata?: any;
}

/**
 * Resolves a platform ID to a user-friendly display name.
 * Checks custom store constants first (Steam, Epic, GOG, etc.),
 * then falls back to searching the game's full IGDB metadata strings.
 */
const getPlatformDisplayName = (id: number, game: any) => {
  // 1. Look up in custom constants (Stores: Steam, Epic, etc.)
  if (CUSTOM_PLATFORM_DATA[id]) {
    return CUSTOM_PLATFORM_DATA[id].name;
  }

  // 2. Fallback: Search the game's full IGDB platform metadata
  try {
    const allPlatforms = typeof game.platforms === 'string' 
      ? JSON.parse(game.platforms || '[]') 
      : (game.platforms || []);
    const match = allPlatforms.find((p: any) => p.id === id);
    return match?.name || match?.abbreviation || `ID: ${id}`;
  } catch (e) {
    return `ID: ${id}`;
  }
};

export const GameMetadata: React.FC<GameMetadataProps> = ({ game, metadata: propMetadata }) => {
  const localMetadata = useGameMetadata(game);
  const metadata = propMetadata || localMetadata;

  // Helper to safely parse JSON arrays from DB
  const safeParse = (json: string | any[] | null) => {
    if (!json) return [];
    try {
      const result = typeof json === 'string' ? JSON.parse(json) : json;
      return Array.isArray(result) ? result : [];
    } catch { return []; }
  };

  const ownedIds = safeParse(game.owned_platform_ids);

  if (!metadata) return null;

  return (
    <div className="bg-card border rounded-xl p-6 shadow-sm space-y-6">
       
       {/* IGDB RATING */}
       {game.rating && (
          <div className="pb-5 border-b border-border">
             <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-muted-foreground uppercase">IGDB Score</h3>
                <span className="text-sm font-bold text-foreground">{Math.round(game.rating)}/100</span>
             </div>
             <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                <div 
                   className="h-full bg-primary transition-all duration-500" 
                   style={{ width: `${game.rating}%` }} 
                />
             </div>
          </div>
       )}

       {/* My Platforms */}
       {ownedIds.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase mb-2">My Platforms</h3>
            <div className="flex flex-wrap gap-2">
               {ownedIds.map((id: number) => {
                  const displayName = getPlatformDisplayName(id, game);
                  return (
                    <div key={id} className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-lg border border-border">
                      <PlatformIcon platformId={id} platformName={displayName} size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-tight">
                        {displayName}
                      </span>
                    </div>
                  );
               })}
            </div>
          </div>
       )}

       <div className="h-px bg-border" />

       {/* Game Info Grid */}
       <div className="space-y-4">
           {metadata.genres && <div><span className="block text-xs font-bold text-muted-foreground uppercase">Genre</span><span className="text-sm font-medium">{metadata.genres}</span></div>}
           {metadata.themes && <div><span className="block text-xs font-bold text-muted-foreground uppercase">Theme</span><span className="text-sm font-medium">{metadata.themes}</span></div>}
           {metadata.modes && <div><span className="block text-xs font-bold text-muted-foreground uppercase">Game Modes</span><span className="text-sm font-medium">{metadata.modes}</span></div>}
           {metadata.perspectives && <div><span className="block text-xs font-bold text-muted-foreground uppercase">Perspective</span><span className="text-sm font-medium">{metadata.perspectives}</span></div>}
       </div>

       <div className="h-px bg-border" />

       {/* Companies */}
       <div className="space-y-4">
           {metadata.developers && <div><span className="block text-xs font-bold text-muted-foreground uppercase">Developer</span><span className="text-sm font-medium">{metadata.developers}</span></div>}
           {metadata.publishers && <div><span className="block text-xs font-bold text-muted-foreground uppercase">Publisher</span><span className="text-sm font-medium">{metadata.publishers}</span></div>}
       </div>

       {/* Technical */}
       {(metadata.engines || metadata.franchises) && (
           <>
               <div className="h-px bg-border" />
               <div className="space-y-4">
                   {metadata.franchises && <div><span className="block text-xs font-bold text-muted-foreground uppercase">Franchise</span><span className="text-sm font-medium">{metadata.franchises}</span></div>}
                   {metadata.engines && <div><span className="block text-xs font-bold text-muted-foreground uppercase">Engine</span><span className="text-sm font-medium">{metadata.engines}</span></div>}
               </div>
           </>
       )}
       
       <div className="pt-3 border-t border-border/50">
           <span className="block text-xs font-bold text-muted-foreground uppercase mb-1">IGDB ID</span>
           <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
              <Database size={10} />
              {game.id}
           </span>
       </div>
    </div>
  );
};
