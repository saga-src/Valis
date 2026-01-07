
import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieIcon, Circle } from 'lucide-react';

interface CompletionWidgetProps {
  library: any[];
}

export const CompletionWidget: React.FC<CompletionWidgetProps> = ({ library }) => {
  const data = useMemo(() => {
    const counts = {
      'Playing': 0,
      'Beaten': 0,
      'Completed': 0,
      'Backlog': 0,
      'Dropped': 0
    };

    library.forEach(g => {
      const s = g.status || 'Backlog';
      if (s === 'Playing') counts['Playing']++;
      else if (s === 'Beat') counts['Beaten']++;
      else if (s === 'Completed') counts['Completed']++;
      else if (s === 'Dropped' || s === 'Shelved') counts['Dropped']++;
      else counts['Backlog']++;
    });

    // Theme-Aware Colors using CSS Variables
    return [
      { name: 'Playing', value: counts['Playing'], color: 'hsl(var(--chart-1))' },
      { name: 'Beaten', value: counts['Beaten'], color: 'hsl(var(--chart-2))' },
      { name: 'Completed', value: counts['Completed'], color: 'hsl(var(--chart-3))' },
      { name: 'Backlog', value: counts['Backlog'], color: 'hsl(var(--chart-4))' },
      { name: 'Dropped', value: counts['Dropped'], color: 'hsl(var(--muted))' },
    ].filter(d => d.value > 0);
  }, [library]);

  const total = data.reduce((acc, curr) => acc + curr.value, 0);

  // Calculate percentage of "Finished" games (Beat + Completed)
  const finishedCount = data
    .filter(d => d.name === 'Beaten' || d.name === 'Completed')
    .reduce((acc, curr) => acc + curr.value, 0);
  const finishedPercent = total > 0 ? Math.round((finishedCount / total) * 100) : 0;

  return (
    <div className="bg-card border rounded-xl p-6 shadow-sm h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <PieIcon size={20} className="text-primary" />
        <h3 className="font-bold text-lg">Completion Status</h3>
        <span className="ml-auto text-xs font-bold text-muted-foreground bg-muted px-2 py-1 rounded-full">
            {total} Games
        </span>
      </div>
      
      <div className="flex-1 w-full min-h-0 flex items-center gap-6">
        {/* Chart */}
        <div className="flex-1 h-full relative">
            <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
                cornerRadius={4}
                >
                {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
                </Pie>
                <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '8px', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                    itemStyle={{ color: 'var(--foreground)', fontWeight: 'bold' }}
                    separator=": "
                />
            </PieChart>
            </ResponsiveContainer>
            
            {/* Center Stat */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-black text-foreground tracking-tighter">
                   {finishedPercent}%
                </span>
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest opacity-70">
                   Cleared
                </span>
            </div>
        </div>

        {/* Breakdown Legend */}
        <div className="w-32 shrink-0 space-y-3">
            {data.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-xs group">
                    <div className="flex items-center gap-2">
                        <Circle size={8} className="text-transparent" style={{ fill: item.color }} />
                        <span className="font-medium text-muted-foreground group-hover:text-foreground transition-colors">{item.name}</span>
                    </div>
                    <span className="font-bold font-mono text-foreground">{item.value}</span>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};
