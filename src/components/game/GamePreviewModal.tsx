
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Star, Calendar, Building2, Tag, Gamepad2, 
  Image as ImageIcon, Users, Eye, Code, Layers, BookOpen 
} from 'lucide-react';
import { getCoverUrl } from '../../lib/api/igdb';
import { cn } from '../../lib/utils/cn';

interface GamePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameId: string;
  initialData?: {
    name?: string;
    cover?: { url: string };
    [key: string]: any;
  };
}

const LoadingSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8 p-8 h-full overflow-hidden">
    {/* Sidebar Skeleton */}
    <div className="flex flex-col gap-6">
      <div className="aspect-[3/4] w-full bg-muted rounded-xl animate-pulse" />
      <div className="space-y-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-1/3 bg-muted rounded animate-pulse" />
            <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
    
    {/* Main Content Skeleton */}
    <div className="space-y-8">
      <div className="h-12 w-3/4 bg-muted rounded animate-pulse" />
      <div className="space-y-2">
        <div className="h-4 w-full bg-muted rounded animate-pulse" />
        <div className="h-4 w-full bg-muted rounded animate-pulse" />
        <div className="h-4 w-5/6 bg-muted rounded animate-pulse" />
      </div>
      <div className="h-32 w-full bg-muted rounded-xl animate-pulse" />
      <div className="grid grid-cols-2 gap-4">
        <div className="aspect-video bg-muted rounded-xl animate-pulse" />
        <div className="aspect-video bg-muted rounded-xl animate-pulse" />
      </div>
    </div>
  </div>
);

export const GamePreviewModal: React.FC<GamePreviewModalProps> = ({ 
  isOpen, 
  onClose, 
  gameId, 
  initialData 
}) => {
  const [details, setDetails] = useState<any>(initialData || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setError(null);
      
      if (initialData) setDetails(initialData);

      const fetchData = async () => {
        try {
            if (window.api && window.api.fetchIGDBGame) {
                const data = await window.api.fetchIGDBGame(gameId);
                if (data) {
                    setDetails(data);
                } else {
                    setError("Could not load game details.");
                }
            } else {
                setError("IGDB API not available.");
            }
        } catch (err: any) {
            console.error("Game preview fetch failed:", err);
            setError("Failed to load data.");
        } finally {
            setLoading(false);
        }
      };

      fetchData();
    }
  }, [isOpen, gameId, initialData]);

  if (!isOpen) return null;

  // --- HELPERS ---
  const parse = (val: any) => {
      try { return typeof val === 'string' ? JSON.parse(val) : val; } catch { return []; }
  };

  const mapList = (list: any[], key: string = 'name') => {
      if (!Array.isArray(list)) return null;
      return list.map(i => i[key] || i).join(', ');
  };

  const getCompanies = (companies: any[], type: 'developer' | 'publisher') => {
      const parsed = parse(companies);
      if (!Array.isArray(parsed)) return null;
      return parsed
          .filter((c: any) => c[type])
          .map((c: any) => c.company?.name || 'Unknown')
          .join(', ');
  };

  // --- DERIVED DATA ---
  const coverUrl = details?.cover_url 
    ? getCoverUrl(details.cover_url, 'big') 
    : details?.cover?.url
        ? getCoverUrl(details.cover.url, 'big')
        : undefined;

  const releaseDate = details?.first_release_date 
    ? new Date(details.first_release_date * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) 
    : 'TBA';

  const genres = mapList(parse(details?.genres));
  const themes = mapList(parse(details?.themes));
  const gameModes = mapList(parse(details?.game_modes));
  const perspectives = mapList(parse(details?.player_perspectives));
  const engines = mapList(parse(details?.game_engines));
  const franchises = mapList(parse(details?.franchises));
  
  const developers = getCompanies(details?.involved_companies, 'developer');
  const publishers = getCompanies(details?.involved_companies, 'publisher');
  
  const screenshots = parse(details?.screenshots || []).slice(0, 4);
  
  const rating = details?.rating || details?.total_rating || 0;
  const ratingColor = rating >= 80 ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' 
                    : rating >= 60 ? 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20' 
                    : 'text-red-500 bg-red-500/10 border-red-500/20';

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl h-[90vh] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 z-50 p-2 bg-background/80 hover:bg-background text-foreground rounded-full transition-colors border border-border shadow-sm"
        >
          <X size={20} />
        </button>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading && !details?.id ? (
               <LoadingSkeleton />
            ) : (
               <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-8 p-8 md:p-10">
                   
                   {/* --- LEFT SIDEBAR (FACT SHEET) --- */}
                   <div className="flex flex-col gap-8">
                       {/* Poster */}
                       <div className="aspect-[3/4] w-full bg-muted rounded-xl overflow-hidden shadow-2xl border border-border/50 relative group">
                           {coverUrl ? (
                               <img src={coverUrl} className="w-full h-full object-cover" alt="Cover" />
                           ) : (
                               <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                                   <ImageIcon size={48} className="opacity-20 mb-2" />
                                   <span className="text-xs font-bold uppercase opacity-50">No Cover</span>
                               </div>
                           )}
                       </div>

                       {/* Metadata List */}
                       <div className="space-y-6 text-sm">
                           
                           {/* Rating */}
                           <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
                               <span className="font-bold text-muted-foreground uppercase text-xs tracking-wider">IGDB Score</span>
                               <div className={cn("px-2 py-0.5 rounded font-black flex items-center gap-1.5", ratingColor)}>
                                   <Star size={14} fill="currentColor" />
                                   {rating > 0 ? Math.round(rating) : 'N/A'}
                               </div>
                           </div>

                           <div className="space-y-4">
                               {releaseDate !== 'TBA' && (
                                   <div>
                                       <span className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase mb-1">
                                           <Calendar size={14} /> Release Date
                                       </span>
                                       <span className="font-medium">{releaseDate}</span>
                                   </div>
                               )}

                               {(developers || publishers) && (
                                   <div>
                                       <span className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase mb-1">
                                           <Building2 size={14} /> Companies
                                       </span>
                                       {developers && <div className="font-medium"><span className="text-muted-foreground text-xs">Dev:</span> {developers}</div>}
                                       {publishers && <div className="font-medium"><span className="text-muted-foreground text-xs">Pub:</span> {publishers}</div>}
                                   </div>
                               )}

                               {genres && (
                                   <div>
                                       <span className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase mb-1">
                                           <Tag size={14} /> Genres
                                       </span>
                                       <span className="font-medium">{genres}</span>
                                   </div>
                               )}

                               {themes && (
                                   <div>
                                       <span className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase mb-1">
                                           <BookOpen size={14} /> Themes
                                       </span>
                                       <span className="font-medium">{themes}</span>
                                   </div>
                               )}

                               {gameModes && (
                                   <div>
                                       <span className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase mb-1">
                                           <Users size={14} /> Modes
                                       </span>
                                       <span className="font-medium">{gameModes}</span>
                                   </div>
                               )}

                               {perspectives && (
                                   <div>
                                       <span className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase mb-1">
                                           <Eye size={14} /> Perspective
                                       </span>
                                       <span className="font-medium">{perspectives}</span>
                                   </div>
                               )}

                               {engines && (
                                   <div>
                                       <span className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase mb-1">
                                           <Code size={14} /> Engine
                                       </span>
                                       <span className="font-medium">{engines}</span>
                                   </div>
                               )}

                               {franchises && (
                                   <div>
                                       <span className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase mb-1">
                                           <Layers size={14} /> Franchise
                                       </span>
                                       <span className="font-medium">{franchises}</span>
                                   </div>
                               )}
                           </div>
                       </div>
                   </div>

                   {/* --- RIGHT CONTENT (MAIN) --- */}
                   <div className="space-y-8 min-w-0">
                       
                       {/* Title */}
                       <div>
                           <h1 className="text-4xl md:text-5xl font-black text-foreground tracking-tight leading-none mb-2">
                               {details?.name}
                           </h1>
                       </div>

                       {/* Summary */}
                       {details?.summary && (
                           <section>
                               <h3 className="text-sm font-bold uppercase text-muted-foreground tracking-wider mb-2 flex items-center gap-2">
                                   <Gamepad2 size={16} /> Overview
                               </h3>
                               <p className="text-lg leading-relaxed text-foreground/90">
                                   {details.summary}
                               </p>
                           </section>
                       )}

                       {/* Storyline */}
                       {details?.storyline && (
                           <section className="bg-muted/30 p-6 rounded-xl border-l-4 border-primary">
                               <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wider mb-2">Plot</h3>
                               <p className="italic text-muted-foreground leading-relaxed">
                                   {details.storyline}
                               </p>
                           </section>
                       )}

                       {/* Gallery */}
                       {screenshots.length > 0 && (
                           <section>
                               <h3 className="text-sm font-bold uppercase text-muted-foreground tracking-wider mb-4">Gallery</h3>
                               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                   {screenshots.map((shot: any, i: number) => (
                                       <div key={i} className="aspect-video bg-muted rounded-xl overflow-hidden border border-border/50 shadow-sm group">
                                           <img 
                                               src={getCoverUrl(shot.url, 'huge')} 
                                               className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                                               alt={`Screenshot ${i}`}
                                               loading="lazy"
                                           />
                                       </div>
                                   ))}
                               </div>
                           </section>
                       )}

                       {error && (
                           <div className="p-4 bg-destructive/10 text-destructive rounded-xl border border-destructive/20 text-sm font-medium">
                               Error: {error}
                           </div>
                       )}
                   </div>
               </div>
            )}
        </div>
      </div>
    </div>,
    document.body
  );
};
