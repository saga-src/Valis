import React, { useState } from 'react';
import { Trophy, Lock, Search, Clock, RefreshCw, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../../../lib/utils/cn';
import { useManualAchievementSync } from '../hooks/useManualAchievementSync';

interface AchievementsTabProps {
  game: any;
  achievements: any[];
  loading: boolean;
  onRefresh?: () => Promise<any>;
}

export const AchievementsTab = ({ game, achievements, loading, onRefresh }: AchievementsTabProps) => {
  const [filter, setFilter] = useState<'all' | 'locked' | 'unlocked'>('all');
  const [search, setSearch] = useState('');
  const manualSync = useManualAchievementSync(game, onRefresh);

  // Helper for dd/mm/yyyy hh:mm format
  const formatFullDate = (timestamp: string | number) => {
    if (!timestamp) return 'Unknown Date';
    const d = new Date(timestamp);
    // Check for invalid date
    if (isNaN(d.getTime())) return 'Unknown Date';
    
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  };

  if (loading) return (
    <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground animate-pulse">
            <Trophy size={48} className="opacity-50" />
            <p className="text-sm font-bold">Loading achievements...</p>
        </div>
    </div>
  );

  const syncButton = (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={manualSync.sync}
        disabled={manualSync.loading || !manualSync.supported}
        title={!manualSync.supported ? manualSync.disabledReason : `Sync missing achievements from ${String(manualSync.platform).toUpperCase()}`}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-black uppercase tracking-wide transition-colors",
          manualSync.supported
            ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
            : "bg-muted/30 border-border text-muted-foreground cursor-not-allowed"
        )}
      >
        {manualSync.loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        Sync Missing
      </button>
      {manualSync.message && (
        <div className={cn(
          "flex items-center gap-1 text-[10px] font-bold max-w-56 text-right",
          manualSync.state === 'success' && "text-emerald-500",
          manualSync.state === 'error' && "text-destructive",
          manualSync.state === 'unsupported' && "text-muted-foreground"
        )}>
          {manualSync.state === 'success' ? <CheckCircle2 size={10} /> : manualSync.state === 'idle' ? <AlertCircle size={10} /> : null}
          <span className="truncate">{manualSync.message}</span>
        </div>
      )}
    </div>
  );

  if (achievements.length === 0) {
    return (
      <div className="h-full flex flex-col gap-4 p-8">
        <div className="flex justify-end">{syncButton}</div>
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground space-y-4 bg-muted/10 rounded-2xl border border-border border-dashed w-full max-w-md mx-auto">
          <Trophy size={48} className="opacity-20" />
          <p className="font-bold">No achievements tracked.</p>
          <p className="text-xs">Play the game to sync progress.</p>
        </div>
      </div>
    );
  }

  // Filter Logic
  const filtered = achievements.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = 
      filter === 'all' ? true :
      filter === 'unlocked' ? a.unlockedAt || a.defaultUnlocked :
      !a.unlockedAt && !a.defaultUnlocked;
    return matchesSearch && matchesStatus;
  });

  const unlockedCount = achievements.filter(a => a.unlockedAt || a.defaultUnlocked).length;
  const percentage = Math.round((unlockedCount / achievements.length) * 100) || 0;

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header / Stats */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-2">
          <h3 className="text-2xl font-black flex items-center gap-3 text-foreground uppercase tracking-wide">
            <Trophy className="text-primary" size={28} />
            Achievements
          </h3>
          <div className="flex items-center gap-3">
             <div className="h-3 w-48 bg-muted rounded-full overflow-hidden relative">
                 <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${percentage}%` }} />
             </div>
             <p className="text-xs font-bold text-muted-foreground">
                {unlockedCount} / {achievements.length} ({percentage}%)
             </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 flex-1 md:flex-none md:items-start">
           {syncButton}
           <div className="relative group flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={16} />
              <input 
                type="text" 
                placeholder="Search names..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-muted/30 border border-border rounded-xl text-sm font-bold text-foreground focus:ring-2 focus:ring-primary/50 outline-none transition-all"
              />
           </div>
           <select 
             value={filter}
             onChange={(e) => setFilter(e.target.value as any)}
             className="px-4 py-2.5 bg-muted/30 border border-border rounded-xl text-sm font-bold text-foreground outline-none cursor-pointer hover:bg-muted/50 transition-all"
           >
             <option value="all">All Status</option>
             <option value="unlocked">Unlocked</option>
             <option value="locked">Locked</option>
           </select>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8 overflow-y-auto custom-scrollbar pr-2">
        {filtered.map((ach) => {
          const isUnlocked = Boolean(ach.unlockedAt || ach.defaultUnlocked);
          
          return (
            <div 
              key={ach.id}
              className={cn(
                "flex gap-4 p-4 rounded-2xl border transition-all duration-300 group relative overflow-hidden h-full",
                isUnlocked 
                  ? "bg-card border-border hover:border-primary/50 shadow-sm" 
                  : "bg-muted/10 border-border/40 opacity-75 grayscale hover:opacity-100"
              )}
            >
              {isUnlocked && <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />}

              {/* Icon Section */}
              <div className="shrink-0 relative w-16 h-16">
                 <img 
                   src={ach.iconUrl || '/images/trophy.png'} 
                   alt={ach.name}
                   onError={(e) => (e.currentTarget.src = '/images/trophy.png')}
                   className={cn(
                     "w-full h-full rounded-xl object-cover shadow-md transition-transform group-hover:scale-105",
                     !isUnlocked && "brightness-50 contrast-125"
                   )}
                 />
                 {!isUnlocked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl backdrop-blur-[1px]">
                        <Lock size={20} className="text-white/80 drop-shadow-md" />
                    </div>
                 )}
              </div>

              {/* Text Content Section */}
              <div className="flex-1 flex flex-col justify-center min-w-0 relative z-10">
                 <h4 className={cn(
                     "font-black text-base truncate leading-tight mb-1",
                     isUnlocked ? "text-foreground" : "text-muted-foreground"
                 )}>
                     {ach.name}
                 </h4>
                
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed font-medium mb-2">
                  {ach.isHidden && !isUnlocked ? "Hidden Achievement. Continue playing to reveal." : ach.description}
                </p>

                {/* ⚡ FIX: Simply check if unlockedAt exists (is not null/undefined) */}
                {isUnlocked && ach.unlockedAt && (
                    <div className="mt-auto flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary/90">
                        <Clock size={10} />
                        <span>Unlocked: {formatFullDate(ach.unlockedAt)}</span>
                    </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AchievementsTab;
