import React, { useState, useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Radar as RadarIcon, Clock, Hash, Check } from 'lucide-react';
import { useRadarData } from '../hooks/useRadarData';
import { cn } from '../../../lib/utils/cn';

interface RadarWidgetProps {
  library: any[]; // Changed from data to library
}

export const RadarWidget: React.FC<RadarWidgetProps> = ({ library }) => {
  // State
  const [dimension, setDimension] = useState<string>('genres');
  const [metric, setMetric] = useState<'count' | 'time'>('count');
  const [mergePc, setMergePc] = useState(true);

  // Data Calculation
  const calculateData = useRadarData(library);
  const data = useMemo(() => 
    calculateData(dimension, metric, mergePc), 
  [calculateData, dimension, metric, mergePc]);

  const color = "hsl(var(--primary))"; 
  const gridColor = "hsl(var(--muted-foreground))"; 
  const textColor = "hsl(var(--muted-foreground))"; 

  return (
    <div className="bg-card border rounded-xl p-4 shadow-sm h-full flex flex-col">
      {/* Header & Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
            <RadarIcon size={20} className="text-primary" />
            <h3 className="font-bold text-lg hidden sm:block">Library DNA</h3>
            <h3 className="font-bold text-lg sm:hidden">DNA</h3>
        </div>
        
        <div className="flex items-center gap-2">
            {/* Metric Toggle */}
            <div className="flex bg-muted/50 p-0.5 rounded-lg border border-border/50 h-8 items-center">
                <button
                    onClick={() => setMetric('count')}
                    className={cn(
                        "px-2 py-1 rounded-md transition-all h-full flex items-center",
                        metric === 'count' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                    title="Count"
                >
                    <Hash size={14} />
                </button>
                <button
                    onClick={() => setMetric('time')}
                    className={cn(
                        "px-2 py-1 rounded-md transition-all h-full flex items-center",
                        metric === 'time' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                    title="Playtime"
                >
                    <Clock size={14} />
                </button>
            </div>

            {/* Merge PC Checkbox (Conditional - Compact) */}
            {dimension === 'platforms' && (
                <button
                    onClick={() => setMergePc(!mergePc)}
                    className={cn(
                        "h-8 px-2 rounded-lg border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all",
                        mergePc ? "bg-primary/10 border-primary text-primary" : "bg-muted/30 border-border text-muted-foreground hover:text-foreground"
                    )}
                    title="Group all PC stores as 'PC'"
                >
                    PC
                </button>
            )}

            {/* Dimension Select */}
            <select 
                value={dimension} 
                onChange={(e) => setDimension(e.target.value)}
                className="h-8 bg-muted/30 border border-border rounded-lg px-2 text-xs font-bold text-foreground focus:ring-1 focus:ring-primary outline-none cursor-pointer min-w-[80px]"
            >
                <option value="genres">Genres</option>
                <option value="platforms">Platforms</option>
                <option value="themes">Themes</option>
                <option value="game_modes">Modes</option>
                <option value="player_perspectives">View</option>
            </select>
        </div>
      </div>

      <div className="flex-1 w-full min-h-0">
        {data.length > 2 ? (
            <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                <PolarGrid gridType="polygon" stroke={gridColor} strokeOpacity={0.4} />
                <PolarAngleAxis 
                dataKey="subject" 
                tick={{ fill: textColor, fontSize: 10, fontWeight: 700 }} 
                />
                <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                <Tooltip 
                contentStyle={{ 
                    backgroundColor: 'var(--card)', 
                    borderRadius: '8px', 
                    border: '1px solid var(--border)', 
                    color: 'var(--foreground)',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    fontSize: '12px',
                    fontWeight: 'bold'
                }}
                itemStyle={{ color: color }}
                cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Radar
                name={metric === 'time' ? 'Hours' : 'Games'}
                dataKey="value"
                stroke={color}
                strokeWidth={3}
                fill={color}
                fillOpacity={0.2}
                isAnimationActive={true}
                />
            </RadarChart>
            </ResponsiveContainer>
        ) : (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground italic">
                Not enough data to map DNA.
            </div>
        )}
      </div>
    </div>
  );
};
