
import React from 'react';
import { getCoverUrl } from '../../../lib/api/igdb';
import { Flame, Clock } from 'lucide-react';
import { cn } from '../../../lib/utils/cn';

interface CurrentObsessionProps {
  data: {
    title: string;
    cover: string;
    hours: number;
    last_played: string;
    platforms?: { id: number; abbreviation?: string; name: string }[];
  } | null;
  className?: string;
}

export const CurrentObsessionCard: React.FC<CurrentObsessionProps> = ({ data, className }) => {
  if (!data) return null;

  return (
    <div className={cn("flex flex-row bg-card border border-border rounded-xl overflow-hidden shadow-sm h-32 group hover:border-red-500/30 transition-colors", className)}>
      {/* Left: Cover - Fixed aspect ratio */}
      <div className="h-full aspect-[2/3] shrink-0 relative bg-muted">
        <img 
            src={getCoverUrl(data.cover, 'big')} 
            alt={data.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        {/* Subtle overlay on cover */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/10" />
      </div>

      {/* Right: Content */}
      <div className="flex-1 p-4 flex flex-col justify-center min-w-0">
        
        {/* Eyebrow */}
        <div className="flex items-center gap-1.5 mb-1">
            <Flame size={10} className="text-red-500 fill-red-500 animate-pulse-slow" />
            <span className="text-[10px] font-black uppercase tracking-widest text-red-500/80">
                Current Obsession
            </span>
        </div>

        {/* Title */}
        <h3 className="text-lg font-black text-foreground leading-none truncate mb-2" title={data.title}>
            {data.title}
        </h3>

        {/* Stats Row */}
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mt-auto">
            <div className="flex items-center gap-1 text-foreground">
                <Clock size={12} className="text-muted-foreground" />
                <span>{data.hours.toFixed(1)}h</span>
                <span className="text-[10px] text-muted-foreground ml-0.5">recent</span>
            </div>

            {data.platforms && data.platforms.length > 0 && (
                <>
                    <span className="text-border">•</span>
                    <div className="flex items-center gap-1 overflow-hidden">
                        {data.platforms.slice(0, 3).map(p => (
                            <span key={p.id} className="px-1.5 py-0.5 bg-secondary rounded text-[9px] font-bold uppercase text-secondary-foreground border border-border/50 whitespace-nowrap">
                                {p.abbreviation || p.name}
                            </span>
                        ))}
                    </div>
                </>
            )}
        </div>
      </div>
    </div>
  );
};
