
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieIcon, Trophy, Flag, Circle, Clock, Gamepad2, TrendingUp, Timer, CircleDollarSign, Coins } from 'lucide-react';
import { useStatusData } from '../hooks/useStatusData';
import { useCoreAnalytics } from '../hooks/useCoreAnalytics';
import { formatDuration } from '../../../lib/utils/format';
import { cn } from '../../../lib/utils/cn';

interface StatusWidgetProps {
  library: any[];
  sessions: any[];
}

const GET_STATUS_COLOR = (status: string) => {
  switch (status) {
    case 'Playing': return 'var(--status-playing)';
    case 'Beat': return 'var(--status-beat)';
    case 'Backlog': return 'var(--status-backlog)';
    case 'Completed': return 'var(--status-completed)';
    case 'Dropped': return 'var(--status-dropped)';
    case 'Shelved': return 'var(--status-shelved)';
    default: return 'var(--muted-foreground)';
  }
};

export const StatusWidget: React.FC<StatusWidgetProps> = ({ library, sessions }) => {
  const { chartData } = useStatusData(library, sessions);

  // Helper to get count by name safely
  const getCount = (name: string) => chartData.find(d => d.name === name)?.value || 0;

  const beatCount = getCount('Beat');
  const completedCount = getCount('Completed');
  const playingCount = getCount('Playing');
  const backlogCount = getCount('Backlog');

  const total = chartData.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="bg-card border rounded-xl p-6 shadow-sm h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <PieIcon size={20} className="text-primary" />
        <h3 className="font-bold text-lg">Completion Status</h3>
        <span className="ml-auto text-xs font-bold text-muted-foreground bg-muted px-2 py-1 rounded-full">
            {total} Games
        </span>
      </div>
      
      <div className="flex-1 w-full min-h-0 flex items-center gap-4">
        {/* Chart */}
        <div className="flex-1 h-full">
            <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
                cornerRadius={4}
                >
                {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={GET_STATUS_COLOR(entry.name)} />
                ))}
                </Pie>
                <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '8px', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                    itemStyle={{ color: 'var(--foreground)', fontWeight: 'bold' }}
                    separator=": "
                />
            </PieChart>
            </ResponsiveContainer>
        </div>

        {/* Breakdown Legend */}
        <div className="w-40 shrink-0 space-y-3">
            <div className="space-y-1">
                <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Active</div>
                <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium"><Circle size={8} className="fill-emerald-500 text-emerald-500" /> Playing</span>
                    <span className="font-mono font-bold">{playingCount}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium"><Circle size={8} className="fill-blue-400 text-blue-400" /> Backlog</span>
                    <span className="font-mono font-bold">{backlogCount}</span>
                </div>
            </div>

            <div className="h-px bg-border/50" />

            <div className="space-y-1">
                <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Finished</div>
                <div className="flex items-center justify-between text-sm text-cyan-500">
                    <span className="flex items-center gap-2 font-bold"><Flag size={12} /> Beat</span>
                    <span className="font-mono font-black text-lg leading-none">{beatCount}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-yellow-500">
                    <span className="flex items-center gap-2 font-bold"><Trophy size={12} /> 100%</span>
                    <span className="font-mono font-black text-lg leading-none">{completedCount}</span>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

// --- SUMMARY WIDGETS ---

interface StatCardProps {
    title: string;
    value: string | number;
    subtitle?: React.ReactNode;
    icon: React.ReactNode;
    colorClass: string;
    loading: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon, colorClass, loading }) => {
    return (
        <div className="h-full bg-card border border-border/50 rounded-xl p-4 flex items-center gap-4 relative overflow-hidden group hover:border-border transition-colors shadow-sm">
            {/* Icon Box */}
            <div className={cn("flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center bg-primary/5 border border-primary/10 transition-colors group-hover:bg-primary/10", colorClass)}>
                 {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { size: 24 }) : icon}
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                 <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-0.5 truncate">{title}</div>
                 <div className={cn("text-2xl font-black tracking-tight text-foreground truncate", loading && "animate-pulse bg-muted text-transparent rounded w-20")}>
                    {value}
                 </div>
                 {subtitle && !loading && (
                    <div className="text-[10px] text-muted-foreground font-medium truncate mt-0.5 opacity-80">
                        {subtitle}
                    </div>
                 )}
            </div>
        </div>
    );
};

// Hook Helper to get metrics cleanly
const useMetrics = () => {
    const { library, sessions, loading } = useCoreAnalytics();
    const { metrics } = useStatusData(library, sessions);
    return { metrics, loading };
};

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
const formatHours = (seconds: number) => `${(seconds / 3600).toFixed(1)}h`;

// 1. Library Value
export const WidgetLibraryValue = () => {
    const { metrics, loading } = useMetrics();
    return (
        <StatCard 
            title="Library Value" 
            value={formatCurrency(metrics.libraryValue)} 
            subtitle={`${formatCurrency(metrics.avgCostPerGame)} per game`}
            icon={<CircleDollarSign />} 
            colorClass="text-emerald-500" 
            loading={loading} 
        />
    );
};

// 2. Cost Per Hour
export const WidgetCostPerHour = () => {
    const { metrics, loading } = useMetrics();
    return (
        <StatCard 
            title="Cost / Hour" 
            value={`${formatCurrency(metrics.costPerHour)}`} 
            subtitle="Value per hour played"
            icon={<Coins />} 
            colorClass="text-yellow-500" 
            loading={loading} 
        />
    );
};

// 3. Total Playtime
export const WidgetTotalPlaytime = () => {
    const { metrics, loading } = useMetrics();
    return (
        <StatCard 
            title="Total Playtime" 
            value={formatHours(metrics.totalPlaytime)} 
            subtitle={`on ${metrics.gamesPlayedCount} games • avg ${formatHours(metrics.avgPlaytimePerGame)} / game`}
            icon={<Clock />} 
            colorClass="text-primary" 
            loading={loading} 
        />
    );
};

// 4. Sessions
export const WidgetSessionsLogged = () => {
    const { metrics, loading } = useMetrics();
    return (
        <StatCard 
            title="Sessions Logged" 
            value={metrics.totalSessions} 
            subtitle={`on ${metrics.uniqueDaysPlayed} days • avg ${metrics.avgPlaytimePerDay > 0 ? (metrics.totalSessions / metrics.uniqueDaysPlayed).toFixed(1) : 0} per day` }
            icon={<Gamepad2 />} 
            colorClass="text-purple-500" 
            loading={loading} 
        />
    );
};

// 5. Beat Rate (was Completion Rate)
export const WidgetBeatRate = () => {
    const { metrics, loading } = useMetrics();
    return (
        <StatCard 
            title="Beat Rate" 
            value={`${metrics.beatRate.toFixed(1)}%`} 
            subtitle={`${metrics.avgTrophyOnBeaten.toFixed(0)}% trophies | ${metrics.perfectOnBeaten.toFixed(0)}% completed`}
            icon={<TrendingUp />} 
            colorClass="text-cyan-500" 
            loading={loading} 
        />
    );
};

// 6. Avg Session
export const WidgetAvgSession = () => {
    const { metrics, loading } = useMetrics();
    const avgDuration = metrics.totalSessions > 0 ? metrics.totalPlaytime / metrics.totalSessions : 0;
    
    // Convert seconds to readable string like "1h 30m" or "45m"
    const h = Math.floor(avgDuration / 3600);
    const m = Math.floor((avgDuration % 3600) / 60);
    const val = h > 0 ? `${h}h ${m}m` : `${m}m`;

    return (
        <StatCard 
            title="Avg Session" 
            value={val} 
            subtitle={`Daily avg: ${formatHours(metrics.avgPlaytimePerDay)}`}
            icon={<Timer />} 
            colorClass="text-orange-500" 
            loading={loading} 
        />
    );
};
