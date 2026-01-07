import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, CartesianGrid, Label } from 'recharts';
import { Crosshair } from 'lucide-react';
import { useScatterData } from '../hooks/useScatterData';
import { useTheme } from '../../../lib/theme';

interface ScatterWidgetProps {
  library: any[];
  gamePlaytimeMap: Record<string, number>;
}

export const ScatterWidget: React.FC<ScatterWidgetProps> = ({ library, gamePlaytimeMap }) => {
  const { theme } = useTheme();
  const data = useScatterData(library, gamePlaytimeMap);

  const gridColor = theme === 'stealth' ? '#404040' : '#e2e8f0';
  const textColor = theme === 'stealth' ? '#737373' : '#64748b';
  const dotColor = theme === 'stealth' ? '#22c55e' : '#8884d8';

  return (
    <div className="bg-card border rounded-xl p-6 shadow-sm h-[400px] flex flex-col">
      <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
        <Crosshair size={20} className="text-primary" /> Value Matrix
      </h3>
      <p className="text-xs text-muted-foreground mb-4">Playtime (Hours) vs. User Score</p>
      
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} strokeOpacity={0.5} />
            <XAxis 
                type="number" 
                dataKey="x" 
                name="Playtime" 
                unit="h" 
                stroke={textColor} 
                tick={{ fill: textColor, fontSize: 12 }}
            >
                <Label value="Hours Played" offset={-10} position="insideBottom" style={{ fill: textColor, fontSize: 10, fontWeight: 600, opacity: 0.5 }} />
            </XAxis>
            <YAxis 
                type="number" 
                dataKey="y" 
                name="Score" 
                domain={[0, 10]} 
                stroke={textColor} 
                tick={{ fill: textColor, fontSize: 12 }}
            >
                <Label value="Score" angle={-90} position="insideLeft" style={{ fill: textColor, fontSize: 10, fontWeight: 600, opacity: 0.5 }} />
            </YAxis>
            <ZAxis type="number" dataKey="z" range={[100, 400]} />
            <Tooltip 
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                            <div className="bg-popover border border-border text-popover-foreground p-3 rounded-lg shadow-xl text-xs space-y-1">
                                <p className="font-black border-b pb-1 mb-1">{d.name}</p>
                                <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground font-bold">Score:</span>
                                    <span className="text-yellow-500 font-black">{d.y}/10</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground font-bold">Time:</span>
                                    <span className="font-mono">{d.x}h</span>
                                </div>
                            </div>
                        );
                    }
                    return null;
                }}
            />
            <Scatter name="Games" data={data} fill={dotColor} fillOpacity={0.6} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};