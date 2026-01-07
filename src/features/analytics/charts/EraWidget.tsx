
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Calendar } from 'lucide-react';
import { useEraData } from '../hooks/useEraData';
import { useTheme } from '../../../lib/theme';

interface EraWidgetProps {
  library: any[];
}

export const EraWidget: React.FC<EraWidgetProps> = ({ library }) => {
  const { theme } = useTheme();
  const data = useEraData(library);

  const gridColor = theme === 'stealth' ? '#404040' : '#e2e8f0';
  const textColor = theme === 'stealth' ? '#737373' : '#64748b';

  return (
    <div className="bg-card border rounded-xl p-6 shadow-sm h-[350px] flex flex-col">
      <div className="flex items-center gap-2 mb-6">
        <Calendar size={20} className="text-primary" /> 
        <h3 className="font-bold text-lg">Library Eras</h3>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} strokeOpacity={0.5} />
            <XAxis 
                dataKey="year" 
                stroke={textColor} 
                tick={{ fill: textColor, fontSize: 11 }}
                minTickGap={30}
                axisLine={false}
                tickLine={false}
            />
            <YAxis 
                hide 
                domain={[0, 'auto']} 
            />
            <Tooltip 
                cursor={{ fill: theme === 'stealth' ? '#262626' : '#f1f5f9' }}
                contentStyle={{ 
                    backgroundColor: 'var(--card)', 
                    borderColor: 'var(--border)', 
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: 'var(--foreground)'
                }}
            />
            <Bar 
                dataKey="count" 
                name="Games"
                fill="hsl(var(--chart-1))" 
                radius={[4, 4, 0, 0]} 
                animationDuration={1000}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
