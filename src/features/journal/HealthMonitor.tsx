
import React, { useMemo } from 'react';
import { isSameDay, format } from 'date-fns';
import { Activity, Leaf, AlertTriangle, Flame } from 'lucide-react';
import { cn } from '../../lib/utils/cn';

function startOfDay(date: Date | number): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function subDays(date: Date | number, amount: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - amount);
  return d;
}

interface HealthMonitorProps {
  sessions: any[];
}

export const HealthMonitor: React.FC<HealthMonitorProps> = ({ sessions }) => {
  const { totalMinutes, days } = useMemo(() => {
    const today = startOfDay(new Date());
    const last7Days = Array.from({ length: 7 }, (_, i) => subDays(today, 6 - i));
    
    // Filter sessions to last 7 days (inclusive of today)
    const recentSessions = sessions.filter(s => {
      const sDate = new Date(s.start_time);
      return sDate >= last7Days[0]; // After start of 7 days ago
    });

    const totalMinutes = recentSessions.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);

    const daysMap = last7Days.map(date => {
      const minutes = recentSessions
        .filter(s => isSameDay(new Date(s.start_time), date))
        .reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);
      
      return { date, minutes };
    });

    return { totalMinutes, days: daysMap };
  }, [sessions]);

  const totalHours = totalMinutes / 60;
  
  // Thresholds
  // < 15h: Healthy
  // 15h - 25h: Moderate
  // > 25h: Touch Grass
  
  let status = {
    label: 'Healthy Balance',
    color: 'text-green-500',
    barColor: 'bg-green-500',
    icon: Leaf,
    message: "You're doing great! Keep it up."
  };

  if (totalHours > 15 && totalHours <= 25) {
    status = {
      label: 'Moderate Intensity',
      color: 'text-yellow-500',
      barColor: 'bg-yellow-500',
      icon: AlertTriangle,
      message: "Getting serious. Don't forget to stretch."
    };
  } else if (totalHours > 25) {
    status = {
      label: 'Touch Grass',
      color: 'text-red-500',
      barColor: 'bg-red-500',
      icon: Flame,
      message: "Whoa there, cowboy. Time for a walk outside."
    };
  }

  // Cap progress bar at 100% for visual consistency, but maybe show overflow differently? 
  // Let's assume max scale is 30h for visual
  const maxScale = 30;
  const progressPercent = Math.min(100, (totalHours / maxScale) * 100);

  return (
    <div className="bg-card border rounded-xl p-5 shadow-sm mb-8 flex flex-col md:flex-row gap-6 items-stretch">
      
      {/* Left: Stats & Status */}
      <div className="flex-1 min-w-[200px]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold flex items-center gap-2 text-foreground">
            <Activity className="text-primary" size={20} />
            7-Day Pulse
          </h3>
          <div className={cn("flex items-center gap-1 text-sm font-bold", status.color)}>
            <status.icon size={16} />
            {status.label}
          </div>
        </div>

        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-3xl font-black">{totalHours.toFixed(1)}h</span>
          <span className="text-sm text-muted-foreground">played this week</span>
        </div>
        
        <p className="text-xs text-muted-foreground mb-4 italic">
          {status.message}
        </p>

        {/* Progress Bar */}
        <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden">
          <div 
            className={cn("h-full transition-all duration-1000 ease-out rounded-full", status.barColor)} 
            style={{ width: `${progressPercent}%` }} 
          />
          {/* Ticks for 15h and 25h */}
          <div className="absolute top-0 bottom-0 left-[50%] w-0.5 bg-background/50" title="15h Limit" />
          <div className="absolute top-0 bottom-0 left-[83%] w-0.5 bg-background/50" title="25h Limit" />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-0.5 font-mono">
          <span>0h</span>
          <span>15h</span>
          <span>25h+</span>
        </div>
      </div>

      {/* Right: Daily Heatmap */}
      <div className="flex flex-col justify-between md:border-l border-border md:pl-6 pt-4 md:pt-0 border-t md:border-t-0">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Daily Breakdown</h4>
        <div className="flex gap-2 h-full items-end">
          {days.map((day, i) => {
            const hours = day.minutes / 60;
            const isToday = i === 6;
            
            // Calculate height percentage (max 8h per day for visual scale)
            const heightPercent = Math.max(15, Math.min(100, (hours / 8) * 100));
            
            let barColor = 'bg-muted-foreground/20';
            if (hours > 0) barColor = 'bg-green-500/50';
            if (hours > 2) barColor = 'bg-green-500';
            if (hours > 4) barColor = 'bg-yellow-500';
            if (hours > 6) barColor = 'bg-red-500';

            return (
              <div key={i} className="flex flex-col items-center gap-1 group relative">
                <div 
                  className={cn("w-8 rounded-sm transition-all duration-500", barColor, isToday && "ring-2 ring-primary ring-offset-1 ring-offset-card")}
                  style={{ height: `${heightPercent}%` }}
                >
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-border">
                        <p className="font-bold">{format(day.date, 'EEE, MMM d')}</p>
                        <p>{hours.toFixed(1)} hours</p>
                    </div>
                </div>
                <span className="text-[10px] font-medium text-muted-foreground">
                  {format(day.date, 'EEE')}
                </span>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
