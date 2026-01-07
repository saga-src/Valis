import React from 'react';
import { Plus } from 'lucide-react';
import { getCoverUrl } from '../../lib/api/igdb';
import { cn } from '../../lib/utils/cn';

interface ShowcaseShelfProps {
  title: string;
  icon?: React.ReactNode;
  slotIds: (string | null)[];
  library: any[];
  onSlotClick: (index: number) => void;
  colorClass?: string;
}

export default function ShowcaseShelf({ title, icon, slotIds, library, onSlotClick, colorClass = "text-primary" }: ShowcaseShelfProps) {
  return (
    <div className="bg-card/50 rounded-2xl border border-border p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className={colorClass}>{icon}</span> {title}
        </h3>
        
        <div className="grid grid-cols-5 gap-3 md:gap-4">
            {slotIds.map((gameId, index) => {
                const game = gameId ? library.find(g => g.id === gameId) : null;
                
                return (
                    <button
                        key={index}
                        onClick={() => onSlotClick(index)}
                        className={cn(
                            "relative aspect-[3/4] rounded-lg overflow-hidden border transition-all group",
                            game 
                                ? "border-border/50 hover:border-primary hover:shadow-lg hover:scale-105" 
                                : "border-dashed border-border bg-muted/20 hover:bg-muted hover:border-muted-foreground/50"
                        )}
                        title={game ? game.title : "Add Game"}
                    >
                        {game ? (
                            <>
                                <img 
                                    src={getCoverUrl(game.cover_url, 'big')} 
                                    alt={game.title}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="text-xs font-bold text-white px-2 py-1 bg-black/50 rounded-full border border-white/20">Edit</span>
                                </div>
                            </>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/50 group-hover:text-primary transition-colors">
                                <Plus size={24} strokeWidth={3} />
                            </div>
                        )}
                    </button>
                );
            })}
        </div>
    </div>
  );
}