import React from 'react';
import { UserLevel } from '../logic/types';

interface UserCardProps {
  level: UserLevel;
  currentXP: number;
  progress: number;
  totalHours: number;
  gameCount: number;
  loading?: boolean;
}

export const UserCard: React.FC<UserCardProps> = ({ 
  level, 
  currentXP, 
  progress, 
  totalHours, 
  gameCount,
  loading = false 
}) => {

  if (loading) {
    return <div className="h-48 w-full animate-pulse rounded-2xl bg-muted/20"></div>;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/80 to-primary text-primary-foreground shadow-lg transition-colors">
      <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 p-8">
        {/* Avatar / Icon */}
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-background/20 text-6xl shadow-inner backdrop-blur-sm border border-background/10">
          {level.icon}
        </div>

        {/* Info */}
        <div className="flex-1 text-center md:text-left">
          <div className="flex flex-col md:flex-row items-center gap-3">
            <h2 className="text-3xl font-black tracking-tight">{level.title}</h2>
            <span className="rounded-full bg-background/20 px-3 py-1 text-xs font-bold uppercase tracking-wider shadow-sm">
              Level {level.level}
            </span>
          </div>
          <p className="mt-1 opacity-80 font-medium">
            {currentXP.toLocaleString()} XP Total
          </p>

          {/* Progress Bar */}
          <div className="mt-4 w-full max-w-md">
            <div className="flex justify-between text-xs font-bold opacity-80 mb-1 uppercase tracking-wider">
              <span>Next Level</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-black/20 shadow-inner">
              <div 
                className="h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-all duration-1000 ease-out" 
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="hidden text-right md:block">
          <div className="mb-2">
            <div className="text-2xl font-bold">{totalHours.toFixed(1)}h</div>
            <div className="text-xs opacity-70 uppercase font-bold tracking-wider">Playtime</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{gameCount}</div>
            <div className="text-xs opacity-70 uppercase font-bold tracking-wider">Games</div>
          </div>
        </div>
      </div>
      
      {/* Decorative Background Circles */}
      <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
      <div className="absolute -left-10 -bottom-10 h-64 w-64 rounded-full bg-black/10 blur-3xl" />
    </div>
  );
};