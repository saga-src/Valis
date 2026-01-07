
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/cloud/supabase';
import { useAuth } from '../../../context/AuthContext';
import { Trophy, Clock, Flag, Crown, User, Gamepad2, Award, Users, Globe, Star, Sparkles } from 'lucide-react';
import { cn } from '../../../lib/utils/cn';
import { format, getISOWeek, getYear } from 'date-fns';
import { useNavigate } from '../../../app/index';
import { AuthWidget } from '../../auth/components/AuthWidget';

// --- Types ---
interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  avatar_url: string;
  score: number;
}

type Period = 'week' | 'month' | 'season' | 'year' | 'all_time';
type TabCategory = 'playtime' | 'genre' | 'beats' | 'achievements' | 'platinum';
type ViewMode = 'global' | 'friends';

// --- Constants ---
const PERIODS: { id: Period; label: string }[] = [
  { id: 'week', label: 'Weekly' },
  { id: 'month', label: 'Monthly' },
  { id: 'season', label: 'Season' },
  { id: 'year', label: 'Yearly' },
  { id: 'all_time', label: 'All Time' },
];

const GENRES = [
  'RPG', 'Action', 'Adventure', 'Strategy', 'Shooter', 
  'Simulation', 'Puzzle', 'Racing', 'Sports', 'Fighting', 'Platform'
];

const TABS = [
  { id: 'playtime', label: 'Playtime', icon: Clock },
  { id: 'genre', label: 'Genre', icon: Gamepad2 },
  { id: 'beats', label: 'Beats', icon: Flag },
  { id: 'achievements', label: 'Trophies', icon: Trophy },
  { id: 'platinum', label: 'Platinums', icon: Award },
];

export const LeaderboardsTab = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // State
  const [period, setPeriod] = useState<Period>('week');
  const [activeTab, setActiveTab] = useState<TabCategory>('playtime');
  const [selectedGenre, setSelectedGenre] = useState<string>('RPG');
  const [viewMode, setViewMode] = useState<ViewMode>('global');
  
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [userEntry, setUserEntry] = useState<LeaderboardEntry | null>(null);

  // 2. Fetch Logic
  useEffect(() => {
    // Only fetch if user is logged in OR we are viewing the global leaderboard
    if (!user && viewMode === 'friends') return;

    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        let rpcCategory = activeTab;
        let rpcSubCategory = 'global';

        if (activeTab === 'genre') {
          rpcCategory = 'playtime';
          rpcSubCategory = selectedGenre;
        }

        // RPC is assumed to be public read
        const { data: result, error } = await supabase.rpc('get_leaderboard', {
          p_period_type: period,
          p_period_key: null,
          p_category: rpcCategory,
          p_sub_category: rpcSubCategory,
          p_limit: 100 
        });

        if (error) throw error;
        
        let safeData: LeaderboardEntry[] = result || [];

        // 3. Client-side Friend Filtering (Mock logic)
        if (viewMode === 'friends' && user) {
            // In a real app, verify against friends list IDs
            safeData = safeData.slice(0, 10); 
        } else {
            safeData = safeData.slice(0, 50);
        }

        setData(safeData);

        // 4. Handle User Ranking Highlight (Defensive check for user.id)
        if (user?.id) {
            const found = safeData.find((entry: any) => entry.user_id === user.id);
            setUserEntry(found || null);
        } else {
            setUserEntry(null);
        }

      } catch (err) {
        console.error('Leaderboard fetch failed:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [period, activeTab, selectedGenre, viewMode, user?.id]);

  // --- Helpers ---
  
  const formatScore = (score: number) => {
    if (activeTab === 'playtime' || activeTab === 'genre') {
      const h = Math.floor(score / 3600);
      const m = Math.floor((score % 3600) / 60);
      return `${h}h ${m}m`;
    }
    return score.toLocaleString();
  };

  const getUnitLabel = () => {
    if (activeTab === 'beats') return 'Beats';
    if (activeTab === 'achievements') return 'Trophies';
    if (activeTab === 'platinum') return 'Platinums';
    return '';
  };

  const getPeriodLabel = () => {
    const now = new Date();
    if (period === 'all_time') return 'All Time Records';
    if (period === 'year') return `Year • ${format(now, 'yyyy')}`;
    if (period === 'month') return format(now, 'MMMM yyyy');
    if (period === 'week') return `Week ${getISOWeek(now)} • ${getYear(now)}`;
    
    // Season Logic
    const month = now.getMonth(); // 0-11
    const year = now.getFullYear();
    let season = 'Winter';
    if (month >= 2 && month <= 4) season = 'Spring';
    else if (month >= 5 && month <= 7) season = 'Summer';
    else if (month >= 8 && month <= 10) season = 'Autumn';
    
    return `${season} Season • ${year}`;
  };

  const getRankStyles = (rank: number) => {
    // Ranks 1-3 are top tier (handled via Podium)
    // Ranks 4 & 5: High Elite (Green Tint)
    if (rank === 4 || rank === 5) {
        return {
            row: "bg-emerald-500/10 border-l-4 border-l-emerald-500 my-2 shadow-sm",
            rankText: "text-xl font-black text-emerald-500",
            avatarSize: "w-10 h-10"
        };
    }
    // Ranks 6-10: Mid Elite (Subtle)
    if (rank >= 6 && rank <= 10) {
        return {
            row: "bg-card/50 border-l-4 border-l-emerald-500/40 my-1",
            rankText: "text-lg font-bold text-foreground/80",
            avatarSize: "w-8 h-8"
        };
    }
    // Ranks 11+: The Field
    return {
        row: "hover:bg-muted/30 border-l-4 border-l-transparent border-b border-border/30",
        rankText: "text-sm font-mono text-muted-foreground",
        avatarSize: "w-8 h-8"
    };
  };

  // --- Renderers ---
  
  const renderAvatar = (url: string, username: string, sizeClass = "w-10 h-10", borderClass = "") => {
    return (
      <div className={cn("relative rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0", sizeClass, borderClass)}>
        {url ? (
          <img src={url} alt={username} className="w-full h-full object-cover" />
        ) : (
          <span className="font-bold text-muted-foreground uppercase text-xs">{username?.charAt(0) || '?'}</span>
        )}
      </div>
    );
  };

  const podium = useMemo(() => {
    if (data.length === 0) return [null, null, null];
    return [data[1] || null, data[0] || null, data[2] || null];
  }, [data]);

  const listItems = useMemo(() => data.slice(3), [data]);

  return (
    <div className="h-full flex flex-col bg-card/30">
      
      {/* --- HEADER --- */}
      <div className="border-b border-border/50 bg-background/80 backdrop-blur-md z-10 sticky top-0 flex flex-col gap-4 p-4 pb-2">
        
        {/* Row 1: 3-Column Layout */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* Left: View Mode Toggle (Now unlocked for everyone) */}
            <div className="flex bg-muted/40 p-1 rounded-full border border-border/40 shrink-0 self-center md:self-auto">
                <button
                    onClick={() => setViewMode('global')}
                    className={cn(
                        "flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all",
                        viewMode === 'global' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <Globe size={14} /> Global
                </button>
                <button
                    onClick={() => setViewMode('friends')}
                    className={cn(
                        "flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all",
                        viewMode === 'friends' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <Users size={14} /> Friends
                </button>
            </div>

            {/* Center: Timeframe & Label */}
            <div className="flex flex-col items-center justify-center gap-1 w-full md:w-auto">
                <div className="flex bg-muted/40 p-1 rounded-lg border border-border/40 overflow-x-auto max-w-full no-scrollbar">
                    {PERIODS.map((p) => (
                        <button
                            key={p.id}
                            onClick={() => setPeriod(p.id)}
                            className={cn(
                                "px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap",
                                period === p.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                    {getPeriodLabel()}
                </span>
            </div>

            {/* Right: Spacer */}
            <div className="w-[140px] hidden md:block" />
        </div>

        {/* Row 2: Categories (Scrollable) */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar justify-center pb-2">
            {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold whitespace-nowrap transition-all",
                            isActive 
                                ? "bg-primary/10 border-primary text-primary" 
                                : "bg-card border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                        )}
                    >
                        <Icon size={14} />
                        {tab.label}
                    </button>
                );
            })}
        </div>

        {/* Row 3 (Conditional): Genre */}
        {activeTab === 'genre' && (
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar snap-x justify-center">
                {GENRES.map(g => (
                    <button
                        key={g}
                        onClick={() => setSelectedGenre(g)}
                        className={cn(
                            "px-3 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wider whitespace-nowrap snap-start transition-colors",
                            selectedGenre === g
                                ? "bg-accent text-accent-foreground border-accent-foreground/20"
                                : "bg-transparent border-transparent text-muted-foreground hover:bg-muted"
                        )}
                    >
                        {g}
                    </button>
                ))}
            </div>
        )}
      </div>

      {/* --- SCROLLABLE CONTENT --- */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative px-6">
         {viewMode === 'friends' && !user ? (
            /* --- FRIENDS AUTH GATE FOR GUESTS --- */
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <div className="p-4 bg-muted/20 rounded-full text-muted-foreground border border-border/50">
                <Users className="w-12 h-12" />
              </div>
              <div className="space-y-2 max-w-sm">
                <h3 className="text-xl font-bold">Compete with Friends</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Sign in to build your circle, share telemetry, and see how you stack up against your rivals on the private board.
                </p>
              </div>
              <div className="w-full max-w-sm mt-4">
                <AuthWidget variant="card" className="shadow-xl ring-1 ring-border" />
              </div>
            </div>
         ) : loading ? (
             <div className="h-64 flex flex-col items-center justify-center gap-3 text-muted-foreground animate-pulse">
                 <Trophy size={48} className="opacity-20" />
                 <span className="text-sm font-bold">Calculating Ranks...</span>
             </div>
         ) : data.length === 0 ? (
             <div className="h-64 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                 <User size={48} className="opacity-20" />
                 <span className="text-sm font-bold">No data found.</span>
                 <span className="text-xs">Be the first to claim the throne!</span>
             </div>
         ) : (
             <div className="pb-24 space-y-6">
                 
                 {/* 1. PODIUM */}
                 <div className="flex items-end justify-center gap-4 sm:gap-8 pt-16 pb-8 min-h-[270px]">
                    
                    {/* 2nd Place */}
                    <div 
                        className="flex flex-col items-center gap-3 w-24 relative top-4 cursor-pointer group"
                        onClick={() => podium[0] && navigate(`/profile/${podium[0].user_id}`)}
                    >
                        {podium[0] && (
                            <>
                                <div className="relative w-16 h-16 group-hover:scale-105 transition-transform">
                                    <Sparkles size={24} className="absolute -top-8 left-1/2 -translate-x-1/2 fill-slate-300 text-slate-300 drop-shadow-md z-10" />
                                    {renderAvatar(podium[0].avatar_url, podium[0].username, 'w-16 h-16', 'border-4 border-slate-300 shadow-xl')}
                                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-slate-400 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg border border-white/20">
                                        #2
                                    </div>
                                </div>
                                <div className="text-center w-full">
                                    <div className="font-bold text-sm truncate text-slate-300 group-hover:text-white transition-colors">{podium[0].username}</div>
                                    <div className="text-[10px] font-mono text-muted-foreground">{formatScore(podium[0].score)}</div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* 1st Place (The King) */}
                    <div 
                        className="flex flex-col items-center gap-3 w-32 z-10 -mt-10 cursor-pointer group"
                        onClick={() => podium[1] && navigate(`/profile/${podium[1].user_id}`)}
                    >
                        {podium[1] && (
                            <>  
                                <div className="relative w-24 h-24 group-hover:scale-105 transition-transform">
                                    <Crown size={48} className="absolute -top-12 left-1/4 -translate-x-1/2 text-yellow-400 fill-yellow-400/20 animate-bounce drop-shadow-lg z-20" />
                                    <div className="absolute inset-0 bg-yellow-500/30 blur-2xl rounded-full animate-pulse pointer-events-none" />
                                    {renderAvatar(podium[1].avatar_url, podium[1].username, 'w-24 h-24', 'border-4 border-yellow-400 shadow-2xl shadow-yellow-500/20')}
                                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-500 to-amber-500 text-black text-xs font-black px-4 py-1 rounded-full shadow-xl border border-white/30 whitespace-nowrap z-30">
                                        #1
                                    </div>
                                </div>
                                <div className="text-center w-full scale-110 mt-3">
                                    <div className="font-black text-lg truncate text-yellow-400 drop-shadow-sm group-hover:text-yellow-300 transition-colors">{podium[1].username}</div>
                                    <div className="text-sm font-mono text-foreground font-bold">{formatScore(podium[1].score)} <span className="text-[9px] text-muted-foreground">{getUnitLabel()}</span></div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* 3rd Place */}
                    <div 
                        className="flex flex-col items-center gap-3 w-24 relative top-8 cursor-pointer group"
                        onClick={() => podium[2] && navigate(`/profile/${podium[2].user_id}`)}
                    >
                        {podium[2] && (
                            <>
                                <div className="relative w-14 h-14 group-hover:scale-105 transition-transform">
                                    <Star size={20} className="absolute -top-7 left-1/2 -translate-x-1/2 fill-amber-700 text-amber-700 drop-shadow-md z-10" />
                                    {renderAvatar(podium[2].avatar_url, podium[2].username, 'w-14 h-14', 'border-4 border-orange-700 shadow-lg')}
                                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-orange-700 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg border border-white/20">
                                        #3
                                    </div>
                                </div>
                                <div className="text-center w-full">
                                    <div className="font-bold text-sm truncate text-orange-600 group-hover:text-orange-500 transition-colors">{podium[2].username}</div>
                                    <div className="text-[10px] font-mono text-muted-foreground">{formatScore(podium[2].score)}</div>
                                </div>
                            </>
                        )}
                    </div>
                 </div>

                 {/* 2. THE LIST */}
                 <div className="space-y-1 max-w-3xl mx-auto">
                    {listItems.map((entry) => {
                        const style = getRankStyles(entry.rank);
                        // Harden check for entry.user_id matching current user
                        const isCurrentUser = user?.id && entry.user_id === user.id;
                        
                        return (
                            <div 
                                key={entry.user_id} 
                                className={cn(
                                    "flex items-center gap-4 px-4 py-2.5 rounded-lg transition-all cursor-pointer group/row",
                                    style.row,
                                    isCurrentUser && "bg-primary/5 border-l-primary !border-l-4 shadow-[inset_0_0_20px_rgba(var(--primary),0.05)]",
                                    !isCurrentUser && "hover:bg-muted/40"
                                )}
                                onClick={() => navigate(`/profile/${entry.user_id}`)}
                            >
                                <div className={cn("w-8 text-center font-mono", style.rankText)}>
                                    {entry.rank}
                                </div>
                                
                                {renderAvatar(entry.avatar_url, entry.username, style.avatarSize)}
                                
                                <div className="flex-1 min-w-0 font-bold text-sm truncate flex items-center gap-2">
                                    <span className={cn(isCurrentUser ? "text-primary" : "text-foreground group-hover/row:text-primary transition-colors")}>{entry.username}</span>
                                    {isCurrentUser && <span className="text-[9px] bg-primary text-primary-foreground px-1.5 rounded font-black uppercase">YOU</span>}
                                </div>

                                <div className="font-mono font-bold text-right text-sm">
                                    {formatScore(entry.score)} <span className="text-[10px] text-muted-foreground font-sans">{getUnitLabel()}</span>
                                </div>
                            </div>
                        );
                    })}
                 </div>
             </div>
         )}
      </div>

      {/* --- STICKY FOOTER (Current User Only) --- */}
      {user?.id && userEntry && viewMode !== 'friends' && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-lg px-6 z-20">
            <div className={cn(
                "backdrop-blur-md rounded-2xl p-3 shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-10 border-t border-white/10 cursor-pointer hover:scale-[1.02] transition-transform",
                getRankStyles(userEntry.rank).row.includes("bg-emerald") 
                    ? "bg-zinc-900/90 border-l-4 border-l-emerald-500" 
                    : "bg-background/90 border border-primary/30"
            )}
            onClick={() => navigate(`/profile/${userEntry.user_id}`)}
            >
                <div className={cn("w-10 text-center font-black", userEntry.rank <= 5 ? "text-emerald-500 text-xl" : "text-foreground text-lg")}>
                    #{userEntry.rank}
                </div>
                {renderAvatar(userEntry.avatar_url, userEntry.username, 'w-10 h-10', 'border-2 border-primary')}
                <div className="flex-1">
                    <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Your Rank</div>
                    <div className="font-bold text-sm">{userEntry.username}</div>
                </div>
                <div className="text-right">
                    <div className="font-mono font-black text-lg text-primary">{formatScore(userEntry.score)}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">{getUnitLabel()}</div>
                </div>
            </div>
        </div>
      )}
      
      {/* Empty State Footer if User not Ranked yet (User only) */}
      {user?.id && !userEntry && !loading && data.length > 0 && viewMode !== 'friends' && (
         <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-lg px-6 z-20">
            <div className="bg-background/90 backdrop-blur-md border border-border rounded-2xl p-3 shadow-xl flex items-center justify-between text-sm text-muted-foreground">
                <span className="flex items-center gap-2"><User size={16} /> Not ranked in top 50</span>
                <span className="text-xs">Play more to join the board!</span>
            </div>
         </div>
      )}
    </div>
  );
};
