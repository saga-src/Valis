import React from 'react';
import { useGamification } from './hooks/useGamification';
import { Lock, Check, Trophy, Milestone, Database } from 'lucide-react';
import * as Icons from 'lucide-react';
import { cn } from '../../lib/utils/cn';
import { useTheme } from '../../lib/theme';
import { GENERAL_MARKS } from './logic/generalMarks';
import { GeneralMarkCard } from './components/GeneralMarkCard';

// --- Helper: Dynamic Icon ---
const DynamicIcon = ({ name, className }: { name?: string, className?: string }) => {
  if (!name) return null;
  // @ts-ignore
  const IconComponent = Icons[name] || Icons.Circle;
  return <IconComponent className={className} size={14} />;
};

// --- Helper: Material Styles ---
const getNodeStyles = (rank: number, maxRanks: number, isUnlocked: boolean) => {
  if (!isUnlocked) {
    // Locked: Subtle dashed gray ring with opaque background to sit on top of the line
    return "bg-card border-2 border-dashed border-border text-muted-foreground/20 opacity-50"; 
  }
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
  } else { 
     if (rank === 2) material = 'silver';
     if (rank === 3) material = 'gold';
     if (rank === 4) material = 'emerald';
     if (rank === 5) material = 'diamond';
     if (rank === 6) material = 'obsidian';
  }

  const styles = {
    copper: "bg-gradient-to-br from-[#7D5A50] to-[#3E2723] border-[#A1887F]/30 text-[#EFEBE9] shadow-md",
    silver: "bg-gradient-to-br from-[#E0E0E0] to-[#90A4AE] border-white/40 text-[#263238] shadow-md",
    gold:   "bg-gradient-to-br from-[#FCD34D] via-[#F59E0B] to-[#B45309] border-[#FDE68A]/50 text-[#451a03] shadow-lg",
    emerald:"bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#00E676]/40 to-[#00281F] border-[#69F0AE]/50 text-white animate-pulse-slow shadow-[0_0_8px_rgba(0,230,118,0.4)]",
    diamond:"bg-gradient-to-br from-white/20 to-transparent backdrop-blur-md border-white/40 text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6)]",
    obsidian:"bg-[#050505] border-slate-700 text-white animate-void-surge shadow-[0_0_8px_rgba(139,92,246,0.5)]"
  };
  return styles[material as keyof typeof styles];
};

// --- LOGIC: Smart Progress (0 to Max) ---
const calculateSmartProgress = (current: number, tiers: any[]) => {
  if (!tiers || tiers.length === 0) return 0;

  const totalNodes = tiers.length;
  // Calculate the visual center of the first node (e.g., if 5 nodes, first center is at 10%)
  const startOffset = 100 / (2 * totalNodes); 
  // Calculate the visual width available between the first and last node centers
  const endOffset = 100 - startOffset;
  const availableWidth = endOffset - startOffset;

  // CASE 1: Before Rank 1 (The "0 to Start" segment)
  // We want the bar to grow from the Left Edge (0%) to the First Node Center (startOffset)
  if (current < tiers[0].target) {
    const progressToFirst = current / tiers[0].target; // 0.0 to 1.0
    return progressToFirst * startOffset; // Returns % width relative to total container
  }

  // CASE 2: Beyond Rank 1 (The "Node to Node" segments)
  const maxTarget = tiers[tiers.length - 1].target;
  if (current >= maxTarget) return 100; // Full bar

  // Find active segment between nodes
  let activeIndex = 0;
  for (let i = 0; i < tiers.length - 1; i++) {
    if (current >= tiers[i].target && current < tiers[i + 1].target) {
      activeIndex = i;
      break;
    }
  }

  // Calculate % within that specific segment
  const start = tiers[activeIndex].target;
  const end = tiers[activeIndex + 1].target;
  const segmentProgress = (current - start) / (end - start);

  // Map to visual coordinates starting AFTER the first node
  const totalSegments = totalNodes - 1;
  const rawPercentage = (activeIndex + segmentProgress) / totalSegments;

  // Result: First Node Center + (Progress * Distance between First/Last)
  return startOffset + (rawPercentage * availableWidth);
};

export const MilestonesPage = () => {
  const { level, currentXP, nextLevelXP, unlockedTiers, tree, metrics, loading, unlockedMarks = [] } = useGamification();
  const { theme } = useTheme();
  const isStealth = theme === 'stealth';
  const isMaxLevel = nextLevelXP >= 999999;
  const barWidth = isMaxLevel ? 100 : Math.min(100, Math.max(0, (currentXP / nextLevelXP) * 100));

  if (loading) return <div className="p-10 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  return (
    <div className="p-8 h-full overflow-y-auto bg-background text-foreground pb-20 scrollbar-hide">
      
      {/* HEADER */}
      <div className="mb-8 p-6 rounded-2xl bg-card border border-border relative overflow-hidden shadow-sm">
        {!isStealth && <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-cyan-500 via-purple-500 to-yellow-500 opacity-50" />}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <Milestone size={24} />
            </div>
            <div>
                <h1 className="text-2xl font-bold font-display tracking-tight uppercase">Milestones</h1>
                <p className="text-muted-foreground text-xs tracking-wider uppercase font-medium">Valis Protocol Database</p>
            </div>
          </div>
          <div className="text-right">
             <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1">Clearance Level</div>
            <div className="text-3xl font-black font-mono tabular-nums leading-none text-foreground">{level}</div>
          </div>
        </div>
        <div className="mt-6 w-full h-1.5 bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all duration-1000 ease-out" style={{ width: `${barWidth}%` }} />
        </div>
      </div>

      {/* ARCHETYPES */}
      <div id="archetypes-container" className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {tree.map((archetype: any) => (
          <div key={archetype.id} className="bg-card border border-border rounded-xl p-5 transition-colors hover:border-primary/20">
            <div className="flex items-center gap-3 mb-6 border-b border-border/50 pb-3">
                <div className="w-1 h-6 rounded-full" style={{ backgroundColor: archetype.color }} />
                <div>
                    <h2 className="text-lg font-bold font-display tracking-tight">{archetype.name}</h2>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{archetype.description}</p>
                </div>
            </div>

            <div className="space-y-4">
              {archetype.disciplines.map((disc: any) => {
                const currentMetric = metrics[disc.metric] || 0;
                const maxRanks = disc.tiers.length;
                const maxTarget = disc.tiers[disc.tiers.length - 1].target;
                
                // Calculate Progress
                const visualProgress = calculateSmartProgress(currentMetric, disc.tiers);

                return (
                  <div key={disc.id} className="relative">
                    <div className="flex justify-between items-end mb-4">
                      <div className="flex items-center gap-2">
                          {disc.icon && <DynamicIcon name={disc.icon} className="text-muted-foreground" />}
                          <div>
                            <h3 className="font-bold text-sm text-foreground leading-none">{disc.name}</h3>
                            <p className="text-[10px] text-muted-foreground uppercase mt-1">{disc.description}</p>
                          </div>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                        {currentMetric.toLocaleString()} / {maxTarget.toLocaleString()}
                      </span>
                    </div>
                    
                    {/* --- TRACK CONTAINER --- */}
                    <div className="relative py-2 px-1">
                      
                      {/* 1. BACKGROUND LINE (Gray) */}
                      <div className="absolute top-1/2 left-0 w-full h-[2px] -translate-y-1/2 z-0"> 
                          <div className="w-full h-full bg-border rounded-full" />
                      </div>
                      
                      {/* 2. PROGRESS BAR (Colored) */}
                      <div 
                        className="absolute top-1/2 left-0 h-[2px] bg-primary -translate-y-1/2 rounded-full transition-all duration-1000 ease-out z-0 shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                        style={{ width: `${visualProgress}%` }}
                      />
                      
                      {/* 3. NODES */}
                      <div className="flex justify-between items-center relative z-10">
                        {disc.tiers.map((tier: any) => {
                          const isUnlocked = unlockedTiers.includes(`${disc.id}_${tier.level}`);
                          const isNext = !isUnlocked && currentMetric >= (disc.tiers[tier.level - 2]?.target || 0);
                          const nodeStyle = getNodeStyles(tier.level, maxRanks, isUnlocked);
                          const ringClass = isNext ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : "";

                          return (
                            <div key={tier.level} className="flex flex-col items-center group/node relative flex-1">
                              <div className={cn("w-7 h-7 rounded-full flex items-center justify-center border transition-all duration-300 relative", nodeStyle, ringClass)}>
                                {isUnlocked ? <Check size={12} strokeWidth={3} /> : (isNext ? <Trophy size={12} /> : <Lock size={12} />)}
                              </div>
                              <div className="absolute top-8 text-center w-full">
                                <p className={cn("text-[9px] font-bold uppercase tracking-wider transition-colors truncate px-1", isUnlocked ? "text-foreground" : "text-muted-foreground/40")}>{tier.title}</p>
                                <p className="text-[9px] font-mono text-muted-foreground/40 mt-0.5">{tier.target >= 1000 ? `${tier.target/1000}k` : tier.target}</p>
                              </div>
                              <div className="absolute -top-10 opacity-0 group-hover/node:opacity-100 transition-all duration-200 transform translate-y-2 group-hover/node:translate-y-0 text-center w-24 bg-popover/95 backdrop-blur text-popover-foreground text-[10px] p-2 rounded-lg border border-border shadow-xl z-50 pointer-events-none">
                                <p className="font-bold text-primary">+{tier.xp} XP</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="h-6" />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* --- SPECIAL OPERATIONS (General Marks) --- */}
      <div id="artifacts-container" className="mt-12 mb-6">
         <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary/10 rounded-lg text-primary border border-primary/20">
               <Database size={20} />
            </div>
            <div>
               <h2 className="text-xl font-bold font-display uppercase tracking-tight">Protocol Operations</h2>
               <p className="text-xs text-muted-foreground uppercase tracking-wider">Unique Artifacts & System Anomalies</p>
            </div>
         </div>

         <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {GENERAL_MARKS.map((mark) => {
               // Logic to check if unlocked. 
               const isUnlocked = unlockedMarks.includes(mark.id);
               
               return (
                  <GeneralMarkCard 
                     key={mark.id} 
                     mark={mark} 
                     isUnlocked={isUnlocked} 
                  />
               );
            })}
         </div>
      </div>

    </div>
  );
};