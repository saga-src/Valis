
import React from 'react';
import { Trophy, Lock, Star, Shield, Zap, Eye, Share2, Clock } from 'lucide-react';
import { cn } from '../../lib/utils/cn';

interface ValisAchievement {
  id: string;
  name: string;
  desc: string;
  unlocked: boolean;
  icon: React.ReactNode;
  rarity?: string;
}

export const ValisAchievementsPage: React.FC = () => {
  // Global App Milestones (Valis Protocol)
  const achievements: ValisAchievement[] = [
    { 
      id: '1', 
      name: 'First Blood', 
      desc: 'Synchronized your first game with the digital vault.', 
      unlocked: true,
      icon: <Zap size={24} />,
      rarity: 'Common'
    },
    { 
      id: '2', 
      name: 'Data Architect', 
      desc: 'Linked a game executable for automated session tracking.', 
      unlocked: true,
      icon: <Shield size={24} />,
      rarity: 'Uncommon'
    },
    { 
      id: '3', 
      name: 'Ghost in the Shell', 
      desc: 'Maintained operator status in Stealth mode for over 10 hours.', 
      unlocked: false,
      icon: <Eye size={24} />,
      rarity: 'Rare'
    },
    { 
      id: '4', 
      name: 'Vault Overseer', 
      desc: 'Registered 50 unique titles into your primary library.', 
      unlocked: false,
      icon: <Star size={24} />,
      rarity: 'Epic'
    },
    { 
      id: '5', 
      name: 'Master of Time', 
      desc: 'Accumulated 1,000 hours of precision-tracked playtime.', 
      unlocked: false,
      icon: <Clock size={24} />,
      rarity: 'Legendary'
    },
    { 
      id: '6', 
      name: 'Social Butterfly', 
      desc: 'Exported 5 unique game verdict cards to external networks.', 
      unlocked: false,
      icon: <Share2 size={24} />,
      rarity: 'Rare'
    },
    { 
      id: '7', 
      name: 'Protocol Alpha', 
      desc: 'Logged at least one session for every game in your backlog.', 
      unlocked: false,
      icon: <Trophy size={24} />,
      rarity: 'Epic'
    }
  ];

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  return (
    <div className="p-8 max-w-5xl mx-auto w-full animate-in fade-in duration-500 pb-20">
      <div className="mb-10 border-b border-border/50 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
            <h1 className="text-4xl font-display font-black tracking-tighter text-foreground uppercase">
                Valis Protocol
            </h1>
            <p className="text-muted-foreground font-light text-lg">
                Track your journey through the digital vault and system milestones.
            </p>
        </div>
        
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 px-6 text-center md:text-right">
            <div className="text-3xl font-black font-telemetry text-primary italic">
                {unlockedCount} <span className="text-muted-foreground text-sm not-italic font-bold">/ {achievements.length}</span>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Clearance Level</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {achievements.map(ach => (
          <div 
            key={ach.id} 
            className={cn(
               "relative group p-6 rounded-2xl border transition-all duration-500 overflow-hidden",
               ach.unlocked 
                ? "bg-card border-emerald-500/20 shadow-xl shadow-emerald-500/5 hover:border-emerald-500/40" 
                : "bg-muted/5 border-white/5 opacity-40 grayscale"
            )}
          >
            {/* Background Glow */}
            {ach.unlocked && (
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 blur-[40px] rounded-full" />
            )}

            <div className="flex flex-col gap-4 relative z-10">
                <div className={cn(
                    "w-14 h-14 rounded-xl flex items-center justify-center shrink-0 shadow-inner border transition-transform group-hover:scale-110",
                    ach.unlocked 
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                        : "bg-zinc-900 text-zinc-600 border-white/5"
                )}>
                    {ach.unlocked ? ach.icon : <Lock size={24} />}
                </div>

                <div className="space-y-1">
                   <div className="flex items-center justify-between">
                       <h3 className="font-bold text-foreground font-display tracking-tight group-hover:text-primary transition-colors">
                           {ach.name}
                       </h3>
                       {ach.unlocked && ach.rarity && (
                           <span className="text-[8px] font-black uppercase tracking-tighter bg-emerald-500/20 text-emerald-500 px-1.5 py-0.5 rounded">
                               {ach.rarity}
                           </span>
                       )}
                   </div>
                   <p className="text-xs leading-relaxed text-muted-foreground/80 font-medium">
                       {ach.desc}
                   </p>
                </div>
            </div>

            {/* Achievement Footer */}
            {ach.unlocked && (
                <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-mono font-bold text-emerald-500/70 uppercase tracking-widest">Operator Cleared</span>
                </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
