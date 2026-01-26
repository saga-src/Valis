
import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { cn } from '../../../lib/utils/cn';
import { GeneralMark } from '../logic/generalMarks';

interface GeneralMarkCardProps {
  mark: GeneralMark;
  isUnlocked: boolean;
}

const DynamicIcon = ({ name, className }: { name: string; className?: string }) => {
  // @ts-ignore
  const Icon = Icons[name] || Icons.Circle;
  return <Icon className={className} size={24} />;
};

export const getMarkVisualStyles = (markId: string, visual: GeneralMark['visual'], isUnlocked: boolean) => {
  // LOCKED STATE
  if (!isUnlocked) {
    return {
      card: "bg-card/40 border-dashed border-border/40 opacity-50 grayscale hover:opacity-80 transition-all",
      iconContainer: "bg-secondary/20 text-muted-foreground/30",
      text: "text-muted-foreground",
      subtext: "text-muted-foreground/40",
      border: "border-border/40",
      iconAnim: ""
    };
  }

  // UNLOCKED STATES (Base Styles)
  const styles = {
    stealth: {
      card: "bg-[#0a0a0a] border-neutral-900 shadow-[inset_0_0_20px_#000]",
      iconContainer: "bg-black text-neutral-500 border border-neutral-900",
      text: "text-neutral-400",
      subtext: "text-neutral-600",
      border: "border-neutral-900",
      iconAnim: "animate-float" 
    },
    light: {
      card: "bg-white border-white shadow-[0_0_30px_rgba(255,255,255,0.8)]",
      iconContainer: "bg-white text-yellow-500 drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]",
      text: "text-black font-black",
      subtext: "text-neutral-500 font-bold",
      border: "border-white",
      iconAnim: "animate-spin-slow" 
    },
    holo: {
      card: "bg-gradient-to-br from-cyan-900/30 to-purple-900/30 border-cyan-500/40 backdrop-blur-md badge-holo",
      iconContainer: "bg-cyan-500/10 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.4)]",
      text: "text-cyan-200",
      subtext: "text-cyan-200/50",
      border: "border-cyan-500/40",
      iconAnim: "animate-float"
    },
    neon: {
      card: "bg-slate-900/95 border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.3)] badge-neon",
      iconContainer: "text-purple-400 drop-shadow-[0_0_5px_rgba(168,85,247,1)]",
      text: "text-purple-200 font-bold drop-shadow-[0_0_2px_rgba(168,85,247,0.8)]",
      subtext: "text-purple-400/60",
      border: "border-purple-500",
      iconAnim: "animate-flicker"
    },
    void: {
      card: "bg-black border-slate-800 badge-void",
      iconContainer: "text-slate-500 bg-slate-900/50",
      text: "text-slate-400",
      subtext: "text-slate-700 italic",
      border: "border-slate-800",
      iconAnim: "animate-float" 
    },
    thermal: {
      card: "bg-orange-950/40 border-orange-600/60 badge-thermal",
      iconContainer: "bg-orange-600/10 text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]",
      text: "text-orange-300",
      subtext: "text-orange-500/60",
      border: "border-orange-600/60",
      iconAnim: "animate-vibrate" 
    },
    glitch: {
      card: "bg-slate-900 border-green-500/50 overflow-hidden badge-glitch",
      iconContainer: "text-green-400",
      text: "text-green-400 font-mono tracking-tighter",
      subtext: "text-green-600/60 font-mono",
      border: "border-green-500/50",
      iconAnim: "animate-glitch-icon" 
    },
    retro: {
      card: "bg-[#2b2112] border-amber-700/50 bg-crt badge-retro", 
      iconContainer: "text-amber-500 bg-amber-900/30",
      text: "text-amber-400 font-mono",
      subtext: "text-amber-600/60 font-mono",
      border: "border-amber-700/50",
      iconAnim: "animate-pulse" 
    },
    glass: {
      card: "bg-white/10 border-white/30 backdrop-blur-xl shadow-lg",
      iconContainer: "bg-white/20 text-white",
      text: "text-white",
      subtext: "text-white/60",
      border: "border-white/30",
      iconAnim: "animate-float" 
    },
    organic: {
      card: "bg-emerald-950/40 border-emerald-500/40",
      iconContainer: "text-emerald-400 bg-emerald-900/20",
      text: "text-emerald-200",
      subtext: "text-emerald-500/50",
      border: "border-emerald-500/40",
      iconAnim: "animate-sway" 
    },
    chrome: {
      card: "bg-gradient-to-b from-slate-200 to-slate-400 border-slate-300 shadow-xl",
      iconContainer: "bg-slate-100 text-slate-700 border border-slate-300 shadow-inner",
      text: "text-slate-900 font-black",
      subtext: "text-slate-700",
      border: "border-slate-300",
      iconAnim: "animate-float" 
    },
    gold: {
      card: "bg-gradient-to-br from-yellow-800/30 to-yellow-900/30 border-yellow-500/50",
      iconContainer: "text-yellow-400 bg-yellow-900/30",
      text: "text-yellow-200",
      subtext: "text-yellow-600/60",
      border: "border-yellow-500/50",
      iconAnim: "animate-pulse"
    }
  };

  let selectedStyle = styles[visual] || styles.holo;

  // --- SPECIFIC ANIMATION OVERRIDES ---
  const overrides: Record<string, string> = {
    'the_cartographer': 'animate-spin-aggressive', // Faster 3D spin
    'the_scribe': 'animate-complex-write',         // Erratic writing
    'the_night_owl': 'animate-swing-fixed',        // Fixed pendulum
    'the_constant': 'animate-neon-flow',           // Energy surge
    'the_marathon': 'animate-rapid-warn',          // Critical battery
    'the_archaeologist': 'animate-dig',            // Pickaxe swing
    'the_oracle': 'animate-dice-tumble',           // NEW: Dice tumble
    'the_accountant': 'animate-abacus',            // Sliding beads
    
    'the_neural_handshake': 'animate-shake-x',
    'the_trinity': 'animate-pulse-scale',
    'the_gallerist': 'animate-flash',
    'the_echo': 'animate-radar-sweep',             // NEW: Radar sweep
    'ghost_in_the_machine': 'animate-glitch-icon',
    'architects_signature': 'animate-vsync',
    'the_abyss': 'animate-black-hole',
    'the_emotionalist': 'animate-squash',
    'the_mirror': 'animate-snap-spin',
    'the_filter': 'animate-scan-vertical',
    'the_labeler': 'animate-scan-laser',
    'the_1337': 'animate-cursor',
    'the_identity': 'animate-bio',
    'the_loop': 'animate-rewind',
    'the_overclocker': 'animate-vibrate',
    'the_bottleneck': 'animate-needle',
  };

  if (overrides[markId]) {
      selectedStyle = { ...selectedStyle, iconAnim: overrides[markId] };
  }

  return selectedStyle;
};

export const GeneralMarkCard: React.FC<GeneralMarkCardProps> = ({ mark, isUnlocked }) => {
  const [currentIcon, setCurrentIcon] = useState(mark.iconName);

  // Cycle icons for "The Oracle" when unlocked
  useEffect(() => {
    if (mark.id === 'the_oracle' && isUnlocked) {
      // Use PascalCase names so Lucide can find them
      const dice = ['Dice1', 'Dice2', 'Dice3', 'Dice4', 'Dice5', 'Dice6'];
      const interval = setInterval(() => {
        const random = dice[Math.floor(Math.random() * dice.length)];
        setCurrentIcon(random);
      }, 2000);
      return () => clearInterval(interval);
    } else {
      setCurrentIcon(mark.iconName);
    }
  }, [mark.id, isUnlocked, mark.iconName]);
  
  const style = getMarkVisualStyles(mark.id, mark.visual, isUnlocked);

  return (
    <div className={cn(
      "badge-card-base relative group flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 h-24", 
      `badge-visual-${mark.visual}`,
      style.card,
      style.border,
      !isUnlocked && "scale-[0.98]"
    )}>
      
      {/* 1. Icon (Left) with Animation */}
      <div className={cn("p-3 rounded-xl shrink-0 transition-all badge-icon-base", style.iconContainer)}>
        {/* data-icon attribute is for the Glitch effect to duplicate the content */}
        <div className={style.iconAnim} data-icon="zap"> 
           <DynamicIcon name={currentIcon} />
        </div>
      </div>

      {/* 2. Text Info (Right) */}
      <div className="flex flex-col min-w-0 flex-1 relative z-10">
        <div className="flex justify-between items-start">
           <span className={cn("font-bold text-sm leading-tight truncate pr-2 badge-text-title", style.text)}>
            {mark.title}
           </span>
           {!isUnlocked && <Icons.Lock size={12} className="text-muted-foreground/50 shrink-0" />}
        </div>
        
        {/* Lore - clamped to 2 lines */}
        <p className={cn("text-[10px] mt-1 leading-snug line-clamp-2 italic badge-text-lore", style.subtext)}>
          "{mark.lore}"
        </p>
      </div>

      {/* 3. HOVER TOOLTIP (THE TRIGGER) */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-50 translate-y-2 group-hover:translate-y-0">
        <div className="bg-popover/95 backdrop-blur border border-border text-popover-foreground text-[10px] p-3 rounded-lg shadow-2xl text-center">
            {isUnlocked ? (
                <>
                    <p className="font-bold text-primary mb-1 uppercase tracking-wider text-[9px]">Mission Complete</p>
                    <p className="font-mono text-muted-foreground leading-tight">{mark.trigger}</p>
                </>
            ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground/60 py-1">
                    <Icons.Lock size={16} className="mb-1" />
                    <span className="font-mono font-bold tracking-[0.2em] uppercase text-red-500/50 text-[9px]">
                        [CLASSIFIED]
                    </span>
                </div>
            )}
            {/* Arrow */}
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-popover border-b border-r border-border rotate-45"></div>
        </div>
      </div>

    </div>
  );
};
