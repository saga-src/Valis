
import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/cloud/supabase';
import { formatDistanceToNow } from 'date-fns';
import { 
  Trophy, Clock, Flag, RefreshCw, Activity, 
  CloudDownload, Medal, Zap, Gamepad2, Rocket, Star, CheckCircle2, ArrowRight
} from 'lucide-react';
import * as Icons from 'lucide-react';
import { cn } from '../../../lib/utils/cn';
import { GamePreviewModal } from '../../../components/game/GamePreviewModal';
import { useNavigate } from '../../../app/index';
import { getCoverUrl } from '../../../lib/api/igdb';
import { getStatusColorVar } from '../../library/utils/libraryUtils';
import { GENERAL_MARKS } from '../../gamification/logic/generalMarks';
import { getMarkVisualStyles } from '../../gamification/components/GeneralMarkCard';
import { BadgeReality } from '../../gamification/components/BadgeReality';
import { getRankCardStyle, getMaterial } from '../styles/rankCardStyles';
import { useFeedStore } from '../../../store/feedStore';

// --- TYPES ---
interface FeedItem {
  id: string;
  type: string;
  created_at: string;
  user_id: string;
  game_id?: string;
  data: any; 
  profile?: {
    username: string;
    avatar_url: string;
  };
}

const formatFeedDuration = (totalSeconds: number) => {
  if (!totalSeconds) return '0m';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
};

const DynamicIcon = ({ name, className, size = 24 }: { name: string; className?: string; size?: number }) => {
  // @ts-ignore
  const Icon = Icons[name] || Icons.Trophy;
  return <Icon className={className} size={size} />;
};

// --- SHARED COMPONENTS ---

const UserMeta = ({ profile, timestamp, userId }: { profile?: { username: string, avatar_url: string }, timestamp: string, userId: string }) => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-end shrink-0">
       <div 
         className="flex items-center gap-2 mb-1 cursor-pointer group"
         onClick={(e) => {
           e.stopPropagation();
           navigate(`/profile/${userId}`);
         }}
       >
          <span className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">{profile?.username || 'Unknown'}</span>
          <div className="w-8 h-8 rounded-full bg-muted border border-border shadow-sm overflow-hidden relative group-hover:ring-2 ring-primary transition-all">
            {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold text-xs uppercase">
                    {profile?.username?.charAt(0) || '?'}
                </div>
            )}
          </div>
       </div>
       <span className="text-[10px] text-muted-foreground font-mono uppercase">
          {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
       </span>
    </div>
  );
};

// --- SPECIALIZED CARDS ---

const SessionCard = ({ item }: { item: FeedItem }) => {
  const d = item.data;
  return (
    <div className="flex items-center gap-4 p-4 bg-card/40 border border-border/50 rounded-2xl group hover:border-primary/30 transition-all">
      {/* Left */}
      <div className="w-16 h-20 shrink-0 rounded-lg overflow-hidden bg-muted border border-white/5">
        <img src={getCoverUrl(d.cover_url)} className="w-full h-full object-cover" alt="" />
      </div>
      {/* Center */}
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-0.5">New Session</span>
        <h4 className="text-sm font-black text-foreground truncate">{d.game_title}</h4>
        <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
           <span className="flex items-center gap-1"><Clock size={12} className="text-blue-400" /> {formatFeedDuration(d.duration)}</span>
           <span className="opacity-30">•</span>
           <span className="flex items-center gap-1"><Gamepad2 size={12} className="text-primary" /> {d.platform || 'Unknown'}</span>
           <span className="opacity-30">•</span>
           <span className="text-emerald-500 font-bold">+{d.xp || 0} XP</span>
        </p>
      </div>
      {/* Right */}
      <UserMeta profile={item.profile} timestamp={item.created_at} userId={item.user_id} />
    </div>
  );
};

const SyncCard = ({ item }: { item: FeedItem }) => {
  const d = item.data;
  return (
    <div className="flex items-center gap-4 p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl group">
      {/* Left */}
      <div className="w-16 h-16 shrink-0 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
        <CloudDownload size={32} />
      </div>
      {/* Center */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-black text-foreground uppercase tracking-wider">Synced Library</h4>
        <div className="flex gap-2 mt-2">
           <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] font-black rounded uppercase border border-blue-500/30">
             +{d.count} Games
           </span>
           {d.achievements > 0 && (
             <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-black rounded uppercase border border-amber-500/30">
               +{d.achievements} Trophies
             </span>
           )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 font-medium">Source: {d.platform}</p>
      </div>
      {/* Right */}
      <UserMeta profile={item.profile} timestamp={item.created_at} userId={item.user_id} />
    </div>
  );
};

const GameAddedCard = ({ item }: { item: FeedItem }) => {
  const d = item.data;
  return (
    <div className="flex items-center gap-4 p-4 bg-card/40 border border-border/50 rounded-2xl group">
      {/* Left */}
      <div className="w-16 h-20 shrink-0 rounded-lg overflow-hidden bg-muted border border-white/5">
        <img src={getCoverUrl(d.cover_url)} className="w-full h-full object-cover" alt="" />
      </div>
      {/* Center */}
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-0.5">Game Acquired</span>
        <h4 className="text-sm font-black text-foreground truncate">{d.game_title}</h4>
        <p className="text-[11px] text-muted-foreground mt-1">
           Added to Library • {d.platform || 'Unknown'} • {d.price > 0 ? `$${d.price.toFixed(2)}` : 'FREE'}
        </p>
      </div>
      {/* Right */}
      <UserMeta profile={item.profile} timestamp={item.created_at} userId={item.user_id} />
    </div>
  );
};

const StatusCard = ({ item }: { item: FeedItem }) => {
  const d = item.data;
  const isFinished = d.new_status === 'Beat' || d.new_status === 'Completed';
  
  return (
    <div className={cn(
      "flex items-center gap-4 p-4 border rounded-2xl transition-all",
      d.new_status === 'Beat' ? "bg-cyan-500/5 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.1)]" : 
      d.new_status === 'Completed' ? "bg-yellow-500/5 border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.1)]" :
      "bg-card/40 border-border/50"
    )}>
      {/* Left */}
      <div className="w-16 h-20 shrink-0 rounded-lg overflow-hidden bg-muted border border-white/5">
        <img src={getCoverUrl(d.cover_url)} className="w-full h-full object-cover" alt="" />
      </div>
      {/* Center */}
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-0.5">Changed Status</span>
        <h4 className="text-sm font-black text-foreground truncate">{d.game_title}</h4>
        <div className="flex items-center gap-2 mt-2">
           <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-muted/50 border border-border/50">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getStatusColorVar(d.old_status) }} />
              <span className="text-[10px] font-bold uppercase" style={{ color: getStatusColorVar(d.old_status) }}>{d.old_status}</span>
           </div>
           <ArrowRight size={10} className="text-muted-foreground" />
           <div className={cn(
             "flex items-center gap-1.5 px-2 py-0.5 rounded border",
             isFinished ? "bg-primary text-primary-foreground border-primary shadow-[0_0_10px_rgba(var(--primary),0.3)]" : "bg-muted/50 border-border/50"
           )}>
              <div className="w-1.5 h-1.5 rounded-full bg-current" style={{ color: isFinished ? 'white' : getStatusColorVar(d.new_status) }} />
              <span className="text-[10px] font-black uppercase" style={{ color: isFinished ? 'white' : getStatusColorVar(d.new_status) }}>{d.new_status}</span>
           </div>
        </div>
      </div>
      {/* Right */}
      <UserMeta profile={item.profile} timestamp={item.created_at} userId={item.user_id} />
    </div>
  );
};

const MilestoneCard = ({ item }: { item: FeedItem }) => {
  const d = item.data;
  const level = Number(d.level || 1);
  const maxRanks = Number(d.maxRanks || 5);
  const cardStyle = getRankCardStyle(level, maxRanks);
  
  const material = getMaterial(level, maxRanks);
  // Resolve icon component from string
  // @ts-ignore
  const IconComponent = Icons[d.icon] || Icons.Trophy;

  return (
    <div className={cn("flex items-center gap-4 p-4 border rounded-2xl transition-all group hover:border-primary/20 relative overflow-hidden", cardStyle)}>
      {/* Left: Visual Badge */}
      <div className="shrink-0 relative z-10">
        <BadgeReality 
          rank={level} 
          maxRanks={maxRanks} 
          icon={IconComponent} 
          size="sm"
        />
      </div>

      {/* Center: Information */}
      <div className="flex-1 min-w-0 relative z-10">
        <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-70 block mb-0.5">
          {d.archetype || 'VALIS PROTOCOL'}
        </span>
        <h4 className="text-[10px] font-bold truncate opacity-60 uppercase tracking-tight">
          Achieved {d.discipline || 'Collection'} Rank {level}
        </h4>
        <div className="text-lg font-black tracking-tighter uppercase leading-none mt-1">
          {d.title}
        </div>
      </div>

      {/* Right: User Identity */}
      <div className="relative z-10">
        <UserMeta profile={item.profile} timestamp={item.created_at} userId={item.user_id} />
      </div>
      
      {/* Shimmer for High Ranks */}
      {material === 'diamond' && (
        <div className="absolute inset-0 -translate-x-full animate-shimmer-slow bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 pointer-events-none" />
      )}
    </div>
  );
};

const ProtocolCard = ({ item }: { item: FeedItem }) => {
  const d = item.data;
  
  // 1. Resolve mark definition for fallback visual data
  const mark = GENERAL_MARKS.find(m => m.id === item.data.id || m.title === item.data.name);
  const markId = item.data.id || mark?.id || 'unknown';
  const visual = d.visual || mark?.visual || 'holo';
  
  // 2. Use shared high-fidelity logic
  const style = getMarkVisualStyles(markId, visual as any, true);

  return (
    <div className={cn(
      "flex items-center gap-4 p-4 border rounded-2xl transition-all relative overflow-hidden group",
      `badge-visual-${visual}`,
      style.card,
      style.border
    )}>
      {/* Left */}
      <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center shrink-0 border shadow-inner overflow-hidden", style.iconContainer)}>
        <div className={style.iconAnim} data-icon="zap">
          <DynamicIcon name={d.icon || mark?.iconName || 'Zap'} size={28} />
        </div>
      </div>
      {/* Center */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
            <Zap size={10} className="text-emerald-500 fill-emerald-500 animate-pulse" />
            <span className={cn("text-[9px] font-black uppercase tracking-[0.2em] opacity-70", style.text)}>Protocol Unlocked</span>
        </div>
        <h4 className={cn("text-lg font-black tracking-tight leading-none uppercase italic badge-text-title", style.text)}>{d.name}</h4>
        <p className={cn("text-[10px] opacity-60 leading-snug font-medium italic truncate mt-1 badge-text-lore", style.subtext)}>
          "{d.description}"
        </p>
      </div>
      {/* Right */}
      <div className="relative z-10">
        <UserMeta profile={item.profile} timestamp={item.created_at} userId={item.user_id} />
      </div>

      {/* Decorative Shimmer for Premium Visuals */}
      {(visual === 'holo' || visual === 'glass' || visual === 'diamond') && (
        <div className="absolute top-0 right-0 bottom-0 w-32 bg-gradient-to-l from-white/5 to-transparent skew-x-12 -mr-8 pointer-events-none" />
      )}
    </div>
  );
};

// --- MAIN FEED ---

export const SocialFeed = () => {
  // 1. Use the persisted store for instant loading
  const { items, setFeed } = useFeedStore();
  
  // If we have cached items, we are technically not "loading" visually, 
  // but we might be "refreshing" in the background.
  const [isInitialLoad, setIsInitialLoad] = useState(items.length === 0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [previewGameId, setPreviewGameId] = useState<string | null>(null);
  const [previewInitialData, setPreviewInitialData] = useState<any>(null);

  // 2. Modified Fetch Logic
  const fetchFeed = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const { data: rawData, error } = await supabase
        .rpc('get_social_feed', { limit_count: 50, offset_count: 0 });

      if (error) {
         const { data: fallbackData } = await supabase
            .from('activities')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
         if (fallbackData) await processData(fallbackData);
      } else {
         if (rawData) await processData(rawData);
      }
    } catch (e) {
      console.error('Feed error:', e);
    } finally {
      setIsInitialLoad(false);
      setIsRefreshing(false);
    }
  };

  // 3. Process and Save to Store
  const processData = async (rawData: any[]) => {
      const userIds = [...new Set(rawData.map((item: any) => item.user_id))];
      let profiles: any[] = [];
      if (userIds.length > 0) {
          const { data } = await supabase.from('profiles').select('id, username, avatar_url').in('id', userIds);
          profiles = data || [];
      }
      const enriched = rawData.map((item: any) => ({
        ...item,
        profile: item.username ? { username: item.username, avatar_url: item.avatar_url } : profiles?.find(p => p.id === item.user_id),
      }));
      
      // Save to cache
      setFeed(enriched);
  };

  // 4. Initial Mount & Subscription
  useEffect(() => {
    // Background fetch on mount (silent if we have cache)
    fetchFeed(items.length > 0);

    const subscription = supabase.channel('public:activities')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activities' }, () => {
            // Silently fetch updates when a new row is added
            fetchFeed(true);
        })
        .subscribe();
        
    return () => { subscription.unsubscribe(); };
  }, []);
  
  const renderItem = (item: FeedItem) => {
    switch (item.type) {
      case 'session': return <SessionCard item={item} />;
      case 'sync': 
      case 'import': return <SyncCard item={item} />;
      case 'added': return <GameAddedCard item={item} />;
      case 'status': return <StatusCard item={item} />;
      case 'milestone': return <MilestoneCard item={item} />;
      case 'protocol': return <ProtocolCard item={item} />;
      default: return null;
    }
  };

  return (
    <>
        <div className="bg-card/30 border border-border/50 rounded-xl h-full flex flex-col shadow-inner overflow-hidden">
        <div className="p-4 border-b border-border/50 flex justify-between items-center bg-background/50 backdrop-blur-md">
            <h3 className="font-bold text-sm flex items-center gap-2"><Activity size={16} className="text-primary" /> Network Feed</h3>
            <button onClick={() => fetchFeed(false)} disabled={isRefreshing} className="p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground">
                <RefreshCw size={14} className={cn(isRefreshing && "animate-spin")} />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {isInitialLoad ? (
                // Only show loading spinner if we have NO cached items
                <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground opacity-50">
                    <RefreshCw className="animate-spin" size={24} />
                    <span className="text-xs font-medium">Calibrating telemetry...</span>
                </div>
            ) : items.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground text-xs italic">No signal found. The void remains silent.</div>
            ) : (
                items.map((item) => (
                    <div key={item.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {renderItem(item)}
                    </div>
                ))
            )}
        </div>
        </div>

        <GamePreviewModal 
            isOpen={!!previewGameId}
            onClose={() => setPreviewGameId(null)}
            gameId={previewGameId || ''}
            initialData={previewInitialData}
        />
    </>
  );
};
