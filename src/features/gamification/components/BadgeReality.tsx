import React from 'react';
import { motion, Variants } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../../lib/utils/cn';

interface BadgeProps {
  rank: number;
  maxRanks: number;
  icon: LucideIcon;
  className?: string;
}

export function BadgeReality({ rank, maxRanks, icon: Icon, className }: BadgeProps) {
  
  // --- 1. Material Logic ---
  const getMaterialClass = () => {
    // SHORT TRACK (4 Ranks) -> Copper, Gold, Diamond, Obsidian
    if (maxRanks === 4) {
      if (rank === 1) return "copper";
      if (rank === 2) return "gold";
      if (rank === 3) return "diamond";
      if (rank === 4) return "obsidian";
    }
    // STANDARD TRACK (5 Ranks) -> Copper, Silver, Gold, Diamond, Obsidian
    else if (maxRanks === 5) {
      if (rank === 1) return "copper";
      if (rank === 2) return "silver";
      if (rank === 3) return "gold";
      if (rank === 4) return "diamond";
      if (rank === 5) return "obsidian";
    }
    // EXTENDED TRACK (6 Ranks) -> Full Spectrum
    else {
      if (rank === 1) return "copper";
      if (rank === 2) return "silver";
      if (rank === 3) return "gold";
      if (rank === 4) return "emerald";
      if (rank === 5) return "diamond";
      if (rank === 6) return "obsidian";
    }
    return "copper"; // Fallback
  };

  const material = getMaterialClass();

  // --- 2. Styles Definitions (Tailwind) ---
  const styles = {
    copper: "bg-gradient-to-br from-[#7D5A50] to-[#3E2723] border-[#A1887F]/30 text-[#D7CCC8]/50 shadow-inner",
    silver: "bg-gradient-to-br from-[#E0E0E0] to-[#90A4AE] border-white/40 text-[#37474F] shadow-lg",
    gold:   "bg-gradient-to-br from-[#FCD34D] via-[#F59E0B] to-[#B45309] border-[#FDE68A]/50 text-[#451a03] drop-shadow-sm",
    emerald:"bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#00E676]/40 to-[#00281F] border-[#69F0AE]/50 text-white animate-pulse-slow shadow-[0_0_15px_rgba(0,230,118,0.3)]",
    
    // Diamond: Subtle Shimmer Logic added via 'after:' pseudo-element in CSS or below
    diamond: "bg-gradient-to-br from-white/10 to-transparent backdrop-blur-sm border-white/30 text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4)] relative overflow-hidden",
    
    obsidian:"bg-[#050505] border-slate-800 text-white animate-void-surge shadow-2xl"
  };

  // --- 3. Animation Variants ---
  // Only Obsidian gets the icon scale pulse
  const iconVariants: Variants = {
    obsidian: {
      scale: [1, 1.15, 1],
      filter: ["brightness(1)", "brightness(1.5)", "brightness(1)"],
      transition: { duration: 3, repeat: Infinity, ease: "easeInOut" }
    },
    default: { scale: 1 }
  };

  return (
    <div className={cn(
      "w-20 h-20 rounded-2xl border flex items-center justify-center relative transition-all duration-300 hover:scale-105", 
      styles[material as keyof typeof styles], 
      className
    )}>
      
      {/* Diamond Shimmer Layer (Pseudo-element simulation) */}
      {material === 'diamond' && (
        <div className="absolute inset-0 -translate-x-full animate-shimmer-slow bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12" />
      )}

      {/* Icon Render */}
      <motion.div 
        animate={material === 'obsidian' ? "obsidian" : "default"}
        variants={iconVariants}
      >
        <Icon size={32} strokeWidth={material === 'copper' ? 1.5 : 2} />
      </motion.div>
    </div>
  );
}