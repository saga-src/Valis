
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import * as Icons from 'lucide-react';
import { cn } from '../../../lib/utils/cn';

export interface ShardItem {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  iconName?: string;
  visual?: string; // 'holo', 'glitch', 'stealth', etc.
  type?: 'default' | 'milestone' | 'protocol';
  subtitle?: string; // For milestones or extra context
  lore?: string; // For protocols
  soundUrl?: string; // Path to sound file (if audio enabled)
}

interface AchievementShardProps {
  item: ShardItem;
  onComplete: () => void;
}

const DynamicIcon = ({ name, className }: { name: string; className?: string }) => {
  // @ts-ignore
  const Icon = Icons[name] || Icons.Trophy;
  return <Icon className={className} size={24} />;
};

export const AchievementShard = ({ item, onComplete }: AchievementShardProps) => {
  const [isVisible, setIsVisible] = useState(false);

  // Play sound strictly when the visual component mounts
  useEffect(() => {
    if (item.soundUrl) {
      const audio = new Audio(item.soundUrl);
      audio.volume = 0.5;
      audio.play().catch((e) => {
          // Autoplay policy or file not found
          console.warn('Shard audio playback failed:', e);
      });
    }
  }, [item.soundUrl]); // Depend on the URL so unique items trigger unique sounds

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setIsVisible(true));

    // Auto dismiss after 5 seconds
    const timer = setTimeout(() => {
      handleClose();
    }, 5000);

    return () => clearTimeout(timer);
  }, [item]); // Reset timer if item changes (though usually component remounts)

  const handleClose = () => {
    setIsVisible(false);
    // Wait for exit animation to finish before unmounting
    setTimeout(onComplete, 500); 
  };

  // Visual Styles Mapping
  const getStyles = (visual?: string, type?: string) => {
    // Protocols (Themed)
    const map: Record<string, any> = {
      stealth: {
        container: "bg-neutral-950 border-neutral-800 text-neutral-400 shadow-none",
        iconBox: "bg-neutral-900 text-neutral-600 border-neutral-800",
        title: "text-neutral-500",
        bar: "bg-neutral-700"
      },
      light: {
        container: "bg-white border-zinc-200 text-black shadow-xl",
        iconBox: "bg-yellow-100 text-yellow-600 border-yellow-200",
        title: "text-zinc-500",
        bar: "bg-yellow-400"
      },
      holo: {
        container: "bg-slate-900/90 border-cyan-500/50 text-cyan-50 shadow-[0_0_20px_rgba(34,211,238,0.3)] backdrop-blur-md",
        iconBox: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
        title: "text-cyan-400",
        bar: "bg-cyan-400"
      },
      neon: {
        container: "bg-slate-950/95 border-fuchsia-500 text-fuchsia-50 shadow-[0_0_20px_rgba(217,70,239,0.4)]",
        iconBox: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30",
        title: "text-fuchsia-400",
        bar: "bg-fuchsia-500"
      },
      void: {
        container: "bg-black border-slate-800 text-slate-300 shadow-2xl",
        iconBox: "bg-slate-900 text-slate-500 border-slate-800",
        title: "text-slate-600",
        bar: "bg-slate-800"
      },
      thermal: {
        container: "bg-orange-950/90 border-orange-500/50 text-orange-100 shadow-[0_0_20px_rgba(249,115,22,0.3)]",
        iconBox: "bg-orange-500/20 text-orange-400 border-orange-500/30",
        title: "text-orange-500",
        bar: "bg-orange-500"
      },
      glitch: {
        container: "bg-zinc-900 border-green-500/50 text-green-50 shadow-[0_0_15px_rgba(34,197,94,0.3)] font-mono",
        iconBox: "bg-green-500/20 text-green-400 border-green-500/30",
        title: "text-green-500",
        bar: "bg-green-500"
      },
      retro: {
        container: "bg-amber-950/95 border-amber-600/50 text-amber-100 shadow-lg font-mono",
        iconBox: "bg-amber-600/20 text-amber-400 border-amber-600/30",
        title: "text-amber-500",
        bar: "bg-amber-600"
      },
      glass: {
        container: "bg-white/10 border-white/20 text-white backdrop-blur-xl shadow-lg",
        iconBox: "bg-white/20 text-white border-white/30",
        title: "text-white/80",
        bar: "bg-white"
      },
      organic: {
        container: "bg-emerald-950/90 border-emerald-500/50 text-emerald-50 shadow-lg",
        iconBox: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
        title: "text-emerald-500",
        bar: "bg-emerald-500"
      },
      chrome: {
        container: "bg-gradient-to-b from-slate-200 to-slate-400 border-slate-500 text-slate-900 shadow-xl",
        iconBox: "bg-slate-100/50 text-slate-700 border-slate-400",
        title: "text-slate-600",
        bar: "bg-slate-600"
      },
      gold: {
        container: "bg-gradient-to-br from-yellow-900/90 to-black border-yellow-500/50 text-yellow-50 shadow-[0_0_20px_rgba(234,179,8,0.3)]",
        iconBox: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
        title: "text-yellow-500",
        bar: "bg-yellow-500"
      }
    };

    // Default / Steam (Emerald)
    if (type === 'default' || (!visual && !type)) {
      return {
        container: "bg-zinc-900/95 border-emerald-500/50 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)]",
        iconBox: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
        title: "text-emerald-400",
        bar: "bg-emerald-500"
      };
    }
    
    // Milestone (Color Coded by Archetype)
    if (type === 'milestone') {
      const archetypeMap: Record<string, string> = {
        'The Archivist': 'holo',      // Blue
        'The Completionist': 'gold',  // Yellow
        'The Critic': 'neon',         // Purple
        'The Timekeeper': 'thermal'   // Orange/Red
      };
      
      const themeKey = archetypeMap[item.subtitle || ''] || 'neon';
      return map[themeKey];
    }

    return map[visual || 'holo'] || map.holo;
  };

  const style = getStyles(item.visual, item.type);
  
  // Determine header text
  let headerText = "ACHIEVEMENT UNLOCKED";
  if (item.type === 'milestone') headerText = "MILESTONE REACHED";
  if (item.type === 'protocol') headerText = "PROTOCOL UNLOCKED";

  // Determine Positioning
  const getPositionClasses = () => {
    if (item.type === 'milestone') return "bottom-8 right-8 origin-bottom-right";
    if (item.type === 'default') return "top-8 left-1/2 -translate-x-1/2 origin-top";
    // Protocol (Default center bottom)
    return "bottom-12 left-1/2 -translate-x-1/2 origin-bottom";
  };

  return createPortal(
    <div className={cn(
      "fixed z-[9999] pointer-events-none transition-all duration-500 ease-out transform flex flex-col items-center",
      getPositionClasses(),
      isVisible ? "translate-y-0 opacity-100 scale-100" : "translate-y-12 opacity-0 scale-95"
    )}>
      <div className={cn(
        "flex items-center gap-4 p-4 rounded-xl border min-w-[320px] max-w-md relative overflow-hidden pointer-events-auto group cursor-pointer",
        style.container
      )} onClick={handleClose}>
        
        {/* Close Button (Visible on Hover) */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-white/10">
            <Icons.X size={12} />
        </div>

        {/* Accent Bar */}
        <div className={cn("absolute left-0 top-0 bottom-0 w-1", style.bar)} />

        {/* Icon */}
        <div className={cn("p-3 rounded-lg shrink-0 animate-in zoom-in duration-300", style.iconBox)}>
           {item.iconName ? (
              <DynamicIcon name={item.iconName} />
           ) : item.iconUrl ? (
              <img src={item.iconUrl} className="w-6 h-6 object-cover rounded" alt="" />
           ) : (
              <Icons.Trophy size={24} />
           )}
        </div>

        <div className="flex flex-col min-w-0">
           <span className={cn("text-[10px] uppercase tracking-widest font-black mb-0.5", style.title)}>
             {headerText}
           </span>
           <span className="font-bold text-base leading-tight truncate pr-2">
             {item.name}
           </span>
           {item.lore ? (
             <span className="text-xs opacity-70 italic mt-0.5 line-clamp-3 whitespace-normal">"{item.lore}"</span>
           ) : item.subtitle ? (
             <span className="text-xs opacity-70 mt-0.5 line-clamp-2 whitespace-normal">{item.subtitle}</span>
           ) : null}
        </div>
        
        {/* Shiny decoration line for rich types */}
        {(item.visual === 'holo' || item.visual === 'glass') && (
           <div className="absolute top-0 right-0 bottom-0 w-16 bg-gradient-to-l from-white/10 to-transparent skew-x-12 -mr-4" />
        )}
      </div>
    </div>,
    document.body
  );
};
