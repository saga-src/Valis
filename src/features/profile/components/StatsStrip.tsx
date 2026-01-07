
import React from 'react';
import { Clock, Gamepad2, Trophy, Crown } from 'lucide-react';
import { cn } from '../../../lib/utils/cn';

interface StatsStripProps {
  playtimeHours: number;
  gamesOwned: number;
  gamesBeaten: number;
  platinums: number;
  className?: string;
}

export const StatsStrip: React.FC<StatsStripProps> = ({
  playtimeHours,
  gamesOwned,
  gamesBeaten,
  platinums,
  className
}) => {
  const stats = [
    { label: 'Total Playtime', value: `${playtimeHours.toFixed(0)}h`, icon: Clock, color: 'text-blue-400' },
    { label: 'Collection', value: gamesOwned, icon: Gamepad2, color: 'text-purple-400' },
    { label: 'Campaigns Beat', value: gamesBeaten, icon: Trophy, color: 'text-emerald-400' },
    { label: 'Perfect Games', value: platinums, icon: Crown, color: 'text-yellow-400' },
  ];

  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-4 w-full bg-black/40 backdrop-blur-md border-y border-white/5", className)}>
      {stats.map((stat) => (
        <div 
          key={stat.label} 
          className={cn(
            "flex flex-col items-center justify-center p-6 border-r border-white/5 last:border-r-0 relative group",
            "hover:bg-white/[0.02] transition-colors"
          )}
        >
          <div className="flex items-center gap-2 mb-1 opacity-70 group-hover:opacity-100 transition-opacity">
            <stat.icon size={14} className={stat.color} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</span>
          </div>
          <span className="text-2xl md:text-3xl font-black font-mono text-white tracking-tight drop-shadow-lg">
            {stat.value}
          </span>
        </div>
      ))}
    </div>
  );
};
