
import React from 'react';
import CalendarHeatmap from 'react-calendar-heatmap';
import { format } from 'date-fns';
import { Activity } from 'lucide-react';

interface HeatmapWidgetProps {
  data: { date: string; count: number }[];
  startDate: Date;
  endDate: Date;
}

export const HeatmapWidget: React.FC<HeatmapWidgetProps> = ({ data, startDate, endDate }) => {
  return (
    <div className="bg-card border rounded-xl p-6 shadow-sm h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
           <div className="flex items-center gap-2">
                <Activity className="w-6 h-6 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">Activity Heatmap</h3>
           </div>

           {/* Legend (Moved to Header) */}
           <div className="hidden sm:flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <span>Dormant</span>
                <div className="flex gap-1">
                    <div className="w-3 h-3 rounded-[2px] bg-muted/30 border border-border/50" title="0 hours" />
                    <div className="w-3 h-3 rounded-[2px] bg-primary/30" title="< 1 hour" />
                    <div className="w-3 h-3 rounded-[2px] bg-primary/50" title="1-3 hours" />
                    <div className="w-3 h-3 rounded-[2px] bg-primary/75" title="3-6 hours" />
                    <div className="w-3 h-3 rounded-[2px] bg-primary shadow-sm" title="6+ hours" />
                </div>
                <span>Obsessed</span>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 w-full overflow-hidden min-h-0">
            <CalendarHeatmap
                startDate={startDate}
                endDate={endDate}
                values={data}
                classForValue={(value) => {
                    if (!value || value.count === 0) return 'color-empty';
                    // Scale: 0 -> 4 based on hours played
                    if (value.count < 1) return 'color-scale-1'; // < 1 hour
                    if (value.count < 3) return 'color-scale-2'; // 1-3 hours
                    if (value.count < 6) return 'color-scale-3'; // 3-6 hours
                    return 'color-scale-4'; // 6+ hours (Heavy session)
                }}
                titleForValue={(value) => {
                    if (!value || value.count === 0) return `No activity`;
                    const dateStr = format(new Date(value.date), 'MMM d, yyyy');
                    return `${dateStr}: ${value.count} hours played`;
                }}
                showWeekdayLabels={true}
                gutterSize={3}
            />
        </div>
    </div>
  );
};
