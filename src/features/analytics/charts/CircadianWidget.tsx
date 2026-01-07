
import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Sector, ResponsiveContainer, Tooltip } from 'recharts';
import { Clock, Activity } from 'lucide-react';
import { useCircadianData } from '../hooks/useCircadianData';
import { useTheme } from '../../../lib/theme';
import { cn } from '../../../lib/utils/cn';

interface CircadianWidgetProps {
  sessions: any[];
}

export const CircadianWidget: React.FC<CircadianWidgetProps> = ({ sessions }) => {
  const { data: rawData, maxDuration, maxCount } = useCircadianData(sessions);
  const { theme } = useTheme();
  
  const [metric, setMetric] = useState<'time' | 'chance'>('time');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // 1. Prepare Data for "Equal Slices" Pie
  // We need every slice to be equal size (1) so the clock is evenly distributed.
  const chartData = useMemo(() => {
    return rawData.map(d => ({
        ...d,
        share: 1,       // Equal angle for every hour
    }));
  }, [rawData]);

  const maxValue = metric === 'time' ? maxDuration : maxCount;

  // Find peak hour for center display based on current metric
  const peak = chartData.reduce((prev, current) => {
      const curVal = metric === 'time' ? current.realDuration : current.realCount;
      const prevVal = metric === 'time' ? prev.realDuration : prev.realCount;
      return (curVal > prevVal) ? current : prev;
  }, chartData[0]);

  const peakValue = metric === 'time' ? peak?.realDuration : peak?.realCount;

  // Custom Shape Renderer
  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, startAngle, endAngle, payload, index } = props;
    
    // Use the REAL value based on selected metric
    const val = metric === 'time' ? payload.realDuration : payload.realCount;
    
    // If no activity, render nothing (invisible)
    if (!val || val <= 0) return null;

    const normalized = val / maxValue;
    
    // Visual Config: Base height + dynamic growth
    // Min height 10px so even small values are visible, Max height +50px
    const baseBarHeight = 10; 
    const maxDynamicHeight = 50; 
    const dynamicHeight = maxDynamicHeight * normalized;
    const outerRadius = innerRadius + baseBarHeight + dynamicHeight;

    // Interaction Style
    const isHovered = index === activeIndex;
    // Highlight hovered item, dim others slightly if one is hovered (optional), or just brighten hovered
    const fillOpacity = isHovered ? 1 : 0.6 + (normalized * 0.4); 

    return (
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle + 2} // Small gap
        endAngle={endAngle - 2}
        fill="hsl(var(--primary))"
        fillOpacity={fillOpacity}
        cornerRadius={4}
      />
    );
  };

  return (
    <div className="bg-card border rounded-xl p-6 shadow-sm h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
            <Clock size={20} className="text-primary" />
            <h3 className="font-bold text-lg">Circadian Rhythm</h3>
        </div>
        
        {/* Toggle */}
        <div className="flex bg-muted/50 p-0.5 rounded-lg border border-border/50 h-8">
            <button 
                onClick={() => setMetric('time')} 
                className={cn(
                    "px-2 rounded-md transition-all flex items-center justify-center", 
                    metric === 'time' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
                title="Total Hours"
            >
                <Clock size={14} />
            </button>
            <button 
                onClick={() => setMetric('chance')} 
                className={cn(
                    "px-2 rounded-md transition-all flex items-center justify-center", 
                    metric === 'chance' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
                title="Session Frequency"
            >
                <Activity size={14} />
            </button>
        </div>
      </div>
      
      <div className="flex-1 min-h-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            {/* Context Ring (Subtle guide) */}
            <Pie
              data={[{ value: 1 }]} 
              dataKey="value" 
              cx="50%"
              cy="50%"
              innerRadius="43%" 
              outerRadius="44%" 
              fill="hsl(var(--muted-foreground))" 
              opacity={0.1} 
              isAnimationActive={false} 
              stroke="none"
            />

            {/* Data Bars */}
            <Pie
              data={chartData}
              dataKey="share" // Uses normalized '1' for equal slices
              cx="50%"
              cy="50%"
              innerRadius="45%" // Base ring size
              startAngle={90}   // Start at 12 o'clock
              endAngle={-270}   // Go clockwise full circle
              shape={renderActiveShape}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              isAnimationActive={true}
              animationDuration={600}
              stroke="none"
            />
            <Tooltip 
                content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        const val = metric === 'time' ? d.realDuration : d.realCount;
                        
                        // Hide tooltip if no value
                        if (!val || val <= 0) return null;

                        return (
                            <div className="bg-popover border border-border px-3 py-2 rounded-lg shadow-xl text-xs z-50">
                                <p className="font-bold text-foreground mb-1">{d.label}</p>
                                <p className="text-primary font-mono font-bold">
                                    {metric === 'time' ? `${d.realDuration} hrs` : `${d.realCount} sessions`}
                                </p>
                            </div>
                        );
                    }
                    return null;
                }}
            />
          </PieChart>
        </ResponsiveContainer>
        
        {/* Center Label (Peak Hour) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-70">Peak</span>
            <div className="flex items-baseline">
                <span className="text-3xl font-black text-foreground tracking-tighter">
                    {peak?.label.replace(/AM|PM/, '')}
                </span>
                <span className="text-xs font-bold text-primary ml-0.5">
                    {peak?.label.match(/AM|PM/)?.[0]}
                </span>
            </div>
            {peakValue > 0 && (
                <span className="text-[10px] font-mono text-muted-foreground mt-1 bg-muted/50 px-1.5 py-0.5 rounded">
                    {metric === 'time' ? `${peakValue}h` : `${peakValue}x`}
                </span>
            )}
        </div>
      </div>
    </div>
  );
};
