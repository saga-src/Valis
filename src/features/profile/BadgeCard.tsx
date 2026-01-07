
import React from 'react';
import * as Icons from 'lucide-react';
import { cn } from '../../lib/utils/cn';

interface BadgeCardProps {
  badge: {
    rank: number;
    maxRanks: number;
    title: string;
    archetype: string;
    iconName: string;
    description?: string;
    unlockedAt: string | null;
  };
  className?: string;
}

// Helper: Dynamic Icon
const DynamicIcon = ({ name, className }: { name: string; className?: string }) => {
  // @ts-ignore
  const Icon = Icons[name] || Icons.Trophy;
  return <Icon className={className} size={20} />;
};

export const BadgeCard: React.FC<BadgeCardProps> = ({ badge, className }) => {
  const { rank, maxRanks } = badge;

  // --- 1. Material Logic (Unified Card Style) ---
  const getMaterialStyles = () => {
    // Logic: Map Rank + MaxRanks to a Material Name
    let material = 'copper';
    if (maxRanks === 4) {
       if (rank === 2) material = 'gold';
       if (rank === 3) material = 'diamond';
       if (rank === 4) material = 'obsidian';
    } else if (maxRanks === 5) {
       if (rank === 2) material = 'silver';
       if (rank === 3) material = 'gold';
       if (rank === 4) material = 'diamond';
       if (rank === 5) material = 'obsidian';
    } else { // 6 Ranks
       if (rank === 2) material = 'silver';
       if (rank === 3) material = 'gold';
       if (rank === 4) material = 'emerald';
       if (rank === 5) material = 'diamond';
       if (rank === 6) material = 'obsidian';
    }

    // Styles Dictionary (Background + Text Contrast)
    const styles = {
      copper: {
        card: "bg-gradient-to-br from-[#7D5A50] to-[#3E2723] border-[#A1887F]/30 shadow-md",
        text: "text-[#EFEBE9]",
        subtext: "text-[#D7CCC8]/70",
        icon: "text-[#D7CCC8]",
        border: "border-[#A1887F]/30"
      },
      silver: {
        card: "bg-gradient-to-br from-[#E0E0E0] to-[#90A4AE] border-white/40 shadow-md",
        text: "text-[#263238]", // Dark text for contrast on silver
        subtext: "text-[#455A64]",
        icon: "text-[#263238]",
        border: "border-white/40"
      },
      gold: {
        card: "bg-gradient-to-br from-[#FCD34D] via-[#F59E0B] to-[#B45309] border-[#FDE68A]/50 shadow-lg",
        text: "text-[#451a03]", // Dark brown text for contrast on gold
        subtext: "text-[#78350f]",
        icon: "text-[#451a03]",
        border: "border-[#FDE68A]/50"
      },
      emerald: {
        card: "bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#00E676]/40 to-[#00281F] border-[#69F0AE]/50 animate-pulse-slow",
        text: "text-white",
        subtext: "text-emerald-200/70",
        icon: "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]",
        border: "border-[#69F0AE]/50"
      },
      diamond: {
        card: "bg-gradient-to-br from-white/20 to-transparent backdrop-blur-md border-white/40 relative overflow-hidden",
        text: "text-white",
        subtext: "text-cyan-100/70",
        icon: "text-white drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]",
        border: "border-white/30"
      },
      obsidian: {
        card: "bg-[#050505] border-slate-700 animate-void-surge shadow-2xl",
        text: "text-white",
        subtext: "text-slate-400",
        icon: "text-white drop-shadow-[0_0_10px_rgba(139,92,246,0.8)]",
        border: "border-slate-700"
      }
    };

    // Return the specific style set + the key (for conditional rendering)
    // @ts-ignore
    return { ...styles[material], name: material };
  };

  const style = getMaterialStyles();

  return (
    <div 
      className={cn(
        "relative group flex flex-row items-center gap-3 p-3 rounded-xl border transition-all duration-300 hover:scale-[1.02] w-full text-left",
        style.card,
        style.border,
        className
      )}
    >
      {/* Diamond Shimmer Overlay */}
      {style.name === 'diamond' && (
        <div className="absolute inset-0 -translate-x-full animate-shimmer-slow bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 pointer-events-none" />
      )}

      {/* 1. Icon (Left Side) */}
      <div className={cn("p-2.5 rounded-lg bg-black/10 backdrop-blur-sm shrink-0", style.icon)}>
        <DynamicIcon name={badge.iconName} />
      </div>

      {/* 2. Text Info (Right Side) */}
      <div className="flex flex-col min-w-0 flex-1">
        <span className={cn("font-bold text-sm leading-none truncate", style.text)}>
          {badge.title}
        </span>
        <span className={cn("text-[10px] uppercase tracking-wider font-semibold mt-1 opacity-80 truncate", style.subtext)}>
          {badge.archetype || 'Milestone'} • Rank {rank}
        </span>
      </div>

      {/* Hover Tooltip */}
      <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] pointer-events-none z-50 transform translate-y-2 group-hover:translate-y-0">
        <div className="bg-black/90 backdrop-blur text-white text-[10px] p-2 rounded-lg shadow-xl border border-white/10 text-center font-medium">
            {badge.description || "Milestone Unlocked"}
        </div>
      </div>
      
    </div>
  );
};
