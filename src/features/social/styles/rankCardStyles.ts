
import { cn } from "../../../lib/utils/cn";

type Material = 'copper' | 'silver' | 'gold' | 'emerald' | 'diamond' | 'obsidian';

/**
 * Determines the material type based on rank and track length.
 * Logic mirrors src/features/gamification/components/BadgeReality.tsx
 */
export const getMaterial = (rank: number, maxRanks: number = 5): Material => {
  // SHORT TRACK (4 Ranks) -> Copper, Gold, Diamond, Obsidian
  if (maxRanks === 4) {
    if (rank === 1) return 'copper';
    if (rank === 2) return 'gold';
    if (rank === 3) return 'diamond';
    if (rank === 4) return 'obsidian';
  }
  // EXTENDED TRACK (6 Ranks) -> Copper, Silver, Gold, Emerald, Diamond, Obsidian
  else if (maxRanks === 6) {
    if (rank === 1) return 'copper';
    if (rank === 2) return 'silver';
    if (rank === 3) return 'gold';
    if (rank === 4) return 'emerald';
    if (rank === 5) return 'diamond';
    if (rank === 6) return 'obsidian';
  }
  // STANDARD TRACK (5 Ranks) -> Copper, Silver, Gold, Diamond, Obsidian
  else {
    if (rank === 1) return 'copper';
    if (rank === 2) return 'silver';
    if (rank === 3) return 'gold';
    if (rank === 4) return 'diamond';
    if (rank === 5) return 'obsidian';
  }
  // Fallback
  return 'copper';
};

/**
 * Returns the tailwind classes for the entire Feed Card container based on rank.
 */
export const getRankCardStyle = (level: number, maxRanks: number = 5): string => {
  const material = getMaterial(level, maxRanks);

  const styles: Record<Material, string> = {
    // Basic Materials (Subtle Backgrounds)
    copper: "bg-[#7D5A50]/20 border-[#A1887F]/30 shadow-[0_0_15px_rgba(125,90,80,0.05)]",
    silver: "bg-[#E0E0E0]/10 border-[#E0E0E0]/20 shadow-[0_0_15px_rgba(255,255,255,0.05)]",
    
    // Gold (Subtle Glow)
    gold: "bg-[#FCD34D]/10 border-[#FDE68A]/30 shadow-[0_0_20px_rgba(245,158,11,0.15)]",
    
    // Emerald (Pulse Animation)
    emerald: "bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#00E676]/40 to-[#00281F] border-[#69F0AE]/50 animate-pulse-slow shadow-[0_0_20px_rgba(0,230,118,0.15)]",
    
    // Diamond (Shimmer/Iridescent)
    diamond: "bg-cyan-900/10 border-cyan-400/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] shadow-cyan-500/10 relative overflow-hidden",
    
    // Obsidian (Void Surge Animation - Darkest)
    obsidian: "bg-[#050505] border-slate-700 animate-void-surge shadow-2xl"
  };

  return cn(
    "transition-all duration-500", // Smooth entry
    styles[material] || styles.copper
  );
};
