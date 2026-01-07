
import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/cloud/supabase';
import { formatDistanceToNow } from 'date-fns';
import { 
  Trophy, Clock, Flag, MessageSquare, RefreshCw, Activity, 
  CloudDownload, Medal, Star, Quote, Zap, Gamepad2 
} from 'lucide-react';
import { cn } from '../../../lib/utils/cn';
import { GamePreviewModal } from '../../../components/game/GamePreviewModal';
import { useNavigate } from '../../../app/index';

// --- TYPES ---
interface FeedItem {
  id: string;
  type: 'session' | 'achievement' | 'status' | 'review' | 'import' | 'milestone' | 'protocol';
  created_at: string;
  user_id: string;
  game_id?: string; // Top-level FK from activities table
  data: any; 
  profile?: {
    username: string;
    avatar_url: string;
  };
}

// --- HELPER FUNCTIONS ---
const formatFeedDuration = (totalSeconds: number) => {
  if (!totalSeconds) return '0m';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
};

// --- SUB-COMPONENTS ---

// 1. User Meta (Right Aligned Header - Larger & Readable)
const UserMeta = ({ profile, timestamp, userId }: { profile?: { username: string, avatar_url: string }, timestamp: string, userId: string }) => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-end shrink-0 ml-4">
       <div 
         className="flex items-center gap-3 mb-1 cursor-pointer group"
         onClick={(e) => {
           e.stopPropagation();
           navigate(`/profile/${userId}`);
         }}
       >
          <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{profile?.username || 'Unknown'}</span>
          <div className="w-10 h-10 rounded-full bg-muted border border-border shadow-sm overflow-hidden relative group-hover:ring-2 ring-primary transition-all">
            {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold text-sm">
                    {profile?.username?.charAt(0).toUpperCase() || '?'}
                </div>
            )}
          </div>
       </div>
       <span className="text-xs text-muted-foreground font-medium">
          {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
       </span>
    </div>
  );
};

// 2. System Card (Milestones & Protocols)
const SystemActivityCard = ({ item }: { item: FeedItem }) => {
  const isProtocol = item.type === 'protocol';
  
  // Style Config
  const styles = isProtocol ? {
      bg: "bg-emerald-950/10 border-emerald-500/20",
      iconBox: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      title: "text-emerald-500",
      icon: <Zap size={24} />
  } : {
      bg: "bg-amber-950/10 border-amber-500/20",
      iconBox: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      title: "text-amber-500",
      icon: <Medal size={24} />
  };

  const headerText = isProtocol 
    ? `Protocol • ${item.data.collection || 'System Core'}`
    : `Milestone • ${item.data.archetype || 'Progression'}`;
    
  const titleText = isProtocol
    ? item.data.title || 'Unknown Protocol'
    : item.data.rank 
        ? `Rank ${item.data.rank}: ${item.data.title}`
        : item.data.title;

  return (
    <div className={cn("rounded-2xl p-6 border transition-all hover:bg-muted/10", styles.bg)}>
      <div className="flex gap-6 items-start">
        {/* Left Icon */}
        <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center border shrink-0 shadow-lg", styles.iconBox)}>
          {styles.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
           <div className="flex justify-between items-start mb-2">
              <div className={cn("text-xs font-black uppercase tracking-widest mt-1", styles.title)}>
                  {headerText}
              </div>
              <UserMeta profile={item.profile} timestamp={item.created_at} userId={item.user_id} />
           </div>
           
           <h4 className="text-xl font-black text-foreground leading-tight mb-2">
              {titleText}
           </h4>
           {item.data.detail && (
             <p className="text-sm text-muted-foreground/80 leading-relaxed">{item.data.detail}</p>
           )}
        </div>
      </div>
    </div>
  );
};

// 3. Game Activity Card (Session, Review, Status, Achievement)
const GameActivityCard = ({ item, onGameClick }: { item: FeedItem, onGameClick: (id: string, initialData: any) => void }) => {
  const { type, data } = item;
  
  // Resolve Game ID from data payload or top-level item
  const gameId = data.game_id || item.game_id;
  const isClickable = !!gameId;

  const handlePreview = () => {
    if (isClickable) {
        onGameClick(gameId, {
            name: data.game,
            cover: data.cover_url ? { url: data.cover_url } : undefined
        });
    }
  };
  
  // Helper to render main stat line based on type
  const renderStatLine = () => {
    switch (type) {
        case 'session':
            return (
                <div className="flex items-center gap-2">
                    <Clock className="text-blue-500" size={18} />
                    <span>Played for <strong className="text-foreground">{formatFeedDuration(data.duration)}</strong></span>
                </div>
            );
        case 'status':
            return (
                <div className="flex items-center gap-2">
                    <Flag className="text-green-500" size={18} />
                    <span>Updated status to <strong className="text-green-500 uppercase tracking-wider">{data.status}</strong></span>
                </div>
            );
        case 'review':
             return (
                <div className="flex items-center gap-2">
                    <Star className="text-purple-500 fill-purple-500" size={18} />
                    <span>Rated <strong className="text-purple-400">{data.rating}/10</strong></span>
                </div>
            );
        case 'achievement':
             return (
                <div className="flex items-center gap-2">
                    <Trophy className="text-yellow-500" size={18} />
                    <span>Unlocked <strong className="text-foreground">{data.achievement}</strong></span>
                </div>
            );
        case 'import':
            return (
                <div className="flex items-center gap-2">
                    <CloudDownload className="text-sky-500" size={18} />
                    <span>Imported <strong className="text-foreground">{data.count}</strong> games</span>
                </div>
            );
        default: return null;
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-6 p-6 bg-card/40 border border-border/60 rounded-2xl hover:bg-card/80 hover:border-primary/30 transition-all group shadow-sm">
       {/* 1. BIG COVER */}
       <div 
         onClick={handlePreview}
         className={cn(
             "shrink-0 relative shadow-xl rounded-xl overflow-hidden w-full sm:w-32 sm:h-44 bg-muted border border-white/5",
             isClickable && "cursor-pointer"
         )}
       >
          {data.cover_url ? (
             <img 
               src={data.cover_url} 
               alt={data.game} 
               className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
               loading="lazy" 
             />
          ) : (
             <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
                 <Gamepad2 size={32} className="opacity-20 mb-2" />
                 <span className="text-[10px] uppercase font-bold opacity-50">No Cover</span>
             </div>
          )}
          {/* Shine effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
       </div>

       {/* 2. MAIN CONTENT */}
       <div className="flex-1 flex flex-col justify-center gap-3 min-w-0">
           {/* Title & Header */}
           <div>
               <div className="flex justify-between items-start gap-4">
                   <div className="flex-1 min-w-0">
                       <h3 
                           onClick={handlePreview}
                           className={cn(
                               "text-2xl font-black text-foreground leading-tight line-clamp-2 transition-colors",
                               isClickable ? "cursor-pointer hover:text-primary hover:underline decoration-2 underline-offset-4" : ""
                           )}
                       >
                           {data.game || 'System'}
                       </h3>
                       <div className="flex items-center gap-3 mt-2">
                           {data.platform && (
                               <span className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">
                                  <Gamepad2 size={12} /> {data.platform}
                               </span>
                           )}
                           {/* Mobile Timestamp fallback */}
                           <span className="sm:hidden text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                           </span>
                       </div>
                   </div>
                   
                   {/* 3. USER META (Top Right - Desktop) */}
                   <div className="hidden sm:block">
                        <UserMeta profile={item.profile} timestamp={item.created_at} userId={item.user_id} />
                   </div>
               </div>
           </div>

           {/* Stats Row (Bigger Text) */}
           <div className="flex flex-wrap items-center gap-4 text-base text-muted-foreground font-medium">
               {renderStatLine()}

               {data.xp > 0 && (
                   <span className="flex items-center gap-1 text-emerald-500 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full text-xs border border-emerald-500/20">
                       +{data.xp} XP
                   </span>
               )}
           </div>

           {/* Context Row (Mood/Tags/Review Text) */}
           <div className="flex flex-col gap-3 mt-1">
               {/* Mood & Tags */}
               {(data.mood || (data.tags && data.tags.length > 0)) && (
                   <div className="flex flex-wrap items-center gap-3">
                       {data.mood && (
                           <span className="text-2xl drop-shadow-sm cursor-help hover:scale-110 transition-transform" title="Mood">
                               {data.mood}
                           </span>
                       )}
                       {data.tags?.map((tag: string, i: number) => (
                           <span key={i} className="px-2.5 py-1 bg-secondary/50 text-secondary-foreground rounded-md text-xs font-bold border border-border/50">
                               #{tag}
                           </span>
                       ))}
                   </div>
               )}

               {/* Review/Note Text */}
               {type === 'review' && data.text && (
                    <div className="relative pl-4 border-l-4 border-purple-500/40 bg-purple-500/5 p-3 rounded-r-xl italic text-muted-foreground text-sm">
                        <Quote size={12} className="absolute -left-1.5 -top-1.5 text-purple-500 bg-background rounded-full p-0.5" />
                        "{data.text}"
                    </div>
               )}
               {type === 'session' && data.journal && (
                    <div className="relative pl-4 border-l-4 border-blue-500/40 bg-blue-500/5 p-3 rounded-r-xl italic text-muted-foreground text-sm">
                        "{data.journal}"
                    </div>
               )}
           </div>
       </div>
    </div>
  );
};

export const SocialFeed = () => {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Preview Modal State
  const [previewGameId, setPreviewGameId] = useState<string | null>(null);
  const [previewInitialData, setPreviewInitialData] = useState<any>(null);

  const fetchFeed = async () => {
    setIsRefreshing(true);
    try {
      const { data: rawData, error } = await supabase
        .rpc('get_social_feed', { limit_count: 20, offset_count: 0 });

      if (error) {
         console.warn("RPC failed, falling back to raw table fetch...", error);
         const { data: fallbackData, error: fallbackError } = await supabase
            .from('activities')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);
         
         if (fallbackError) throw fallbackError;
         if (fallbackData) processData(fallbackData);
      } else {
         if (rawData) processData(rawData);
      }

    } catch (e) {
      console.error('Feed error:', e);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const processData = async (rawData: any[]) => {
      // Enrich with Profiles (Batch Fetch)
      const userIds = [...new Set(rawData.map((item: any) => item.user_id))];
      
      let profiles: any[] = [];
      if (userIds.length > 0) {
          const { data } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .in('id', userIds);
          profiles = data || [];
      }

      const enriched = rawData.map((item: any) => ({
        ...item,
        profile: item.username ? { username: item.username, avatar_url: item.avatar_url } : profiles?.find(p => p.id === item.user_id),
      }));
      setItems(enriched);
  };

  useEffect(() => {
    fetchFeed();
    const subscription = supabase
      .channel('public:activities') 
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activities' }, () => fetchFeed())
      .subscribe();
    return () => { subscription.unsubscribe(); };
  }, []);
  
  const handleGameClick = (id: string, initialData: any) => {
      setPreviewInitialData(initialData);
      setPreviewGameId(id);
  };

  return (
    <>
        <div className="bg-card/30 border border-border/50 rounded-xl h-full flex flex-col shadow-inner overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border/50 flex justify-between items-center bg-background/50 backdrop-blur-md">
            <h3 className="font-bold text-sm flex items-center gap-2">
            <Activity size={16} className="text-primary" /> 
            Global Activity
            </h3>
            <button onClick={fetchFeed} disabled={isRefreshing} className="p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground">
                <RefreshCw size={14} className={cn(isRefreshing && "animate-spin")} />
            </button>
        </div>

        {/* Feed List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
            {loading && items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground opacity-50">
                    <RefreshCw className="animate-spin" size={24} />
                    <span className="text-xs font-medium">Syncing feed...</span>
                </div>
            ) : items.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground text-xs italic">
                    No activity yet. Be the first to play!
                </div>
            ) : (
                items.map((item) => (
                    <React.Fragment key={item.id}>
                        {(item.type === 'milestone' || item.type === 'protocol') ? (
                            <SystemActivityCard item={item} />
                        ) : (
                            <GameActivityCard item={item} onGameClick={handleGameClick} />
                        )}
                    </React.Fragment>
                ))
            )}
        </div>
        </div>

        {/* Preview Modal */}
        <GamePreviewModal 
            isOpen={!!previewGameId}
            onClose={() => setPreviewGameId(null)}
            gameId={previewGameId || ''}
            initialData={previewInitialData}
        />
    </>
  );
};
