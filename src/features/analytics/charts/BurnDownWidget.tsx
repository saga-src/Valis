
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useBacklogData } from '../hooks/useBacklogData';
import { useTheme } from '../../../lib/theme';

interface BurnDownWidgetProps {
  library: any[];
  sessions: any[];
}

export const BurnDownWidget: React.FC<BurnDownWidgetProps> = ({ library, sessions }) => {
  const data = useBacklogData(library, sessions);
  const { theme } = useTheme();

  const gridColor = theme === 'stealth' ? '#404040' : '#e2e8f0';
  const textColor = theme === 'stealth' ? '#737373' : '#64748b';

  return (
    <div className="bg-card border rounded-xl p-6 shadow-sm h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={20} className="text-primary" />
        <h3 className="font-bold text-lg">Backlog History</h3>
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} strokeOpacity={0.5} />
            <XAxis 
                dataKey="formattedDate" 
                stroke={textColor} 
                tick={{ fill: textColor, fontSize: 10 }}
                minTickGap={40}
                axisLine={false}
                tickLine={false}
            />
            <YAxis 
                stroke={textColor} 
                tick={{ fill: textColor, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
            />
            <Tooltip 
                contentStyle={{ 
                    backgroundColor: 'var(--card)', 
                    borderColor: 'var(--border)', 
                    borderRadius: '8px',
                    color: 'var(--foreground)'
                }}
                labelStyle={{ fontWeight: 'bold', marginBottom: '4px', color: 'var(--muted-foreground)' }}
            />
            {/* Acquired (Total Potential) */}
            <Area 
                type="monotone" 
                dataKey="Acquired" 
                stackId="1" 
                stroke="hsl(var(--muted-foreground))" 
                fill="hsl(var(--muted))" 
                fillOpacity={0.2}
                strokeDasharray="4 4"
            />
            {/* Beaten (Completed Work) */}
            <Area 
                type="monotone" 
                dataKey="Beaten" 
                stackId="2" // Separate stack to overlay, not stack on top
                stroke="hsl(var(--primary))" 
                fill="hsl(var(--primary))" 
                fillOpacity={0.4}
            />
            {/* The gap between visually represents the backlog */}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
