
import React from 'react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Layers } from 'lucide-react';
import { useGenreEvolution } from '../hooks/useGenreEvolution';

interface GenreStreamWidgetProps {
  library: any[];
  sessions: any[];
}

export const GenreStreamWidget: React.FC<GenreStreamWidgetProps> = ({ library, sessions }) => {
  const { streamData, keys } = useGenreEvolution(library, sessions);

  // Defined Emerald Palette for distinct layers
  const COLORS = [
    "hsl(var(--primary))",           // Brightest
    "hsl(158, 64%, 45%)",            // Dimmer
    "hsl(158, 64%, 35%)",            // Darker
    "hsl(158, 64%, 25%)",            // Deep
    "hsl(158, 64%, 15%)",            // Very Dark
    "hsl(158, 64%, 10%)",            // Abyss
  ];

  return (
    <div className="bg-card border rounded-xl p-6 shadow-sm h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Layers size={20} className="text-primary" />
        <h3 className="font-bold text-lg">Genre Evolution</h3>
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart 
            data={streamData}
            stackOffset="silhouette" // Streamgraph style
            margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
          >
            <XAxis 
                dataKey="year" 
                hide 
            />
            <Tooltip 
                contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                itemStyle={{ color: 'var(--foreground)' }}
            />
            {keys.map((key, index) => {
                const color = COLORS[index % COLORS.length];
                return (
                    <Area
                        key={key}
                        type="monotone"
                        dataKey={key}
                        stackId="1"
                        stroke={color}
                        fill={color}
                        fillOpacity={0.9}
                    />
                );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap gap-2 mt-4 justify-center">
        {keys.map((key, index) => (
             <div key={key} className="flex items-center gap-1.5">
                 <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                 <span className="text-[10px] uppercase font-bold text-muted-foreground">{key}</span>
             </div>
        ))}
      </div>
    </div>
  );
};
