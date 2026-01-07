
import React from 'react';
import { BarChart3, Clock, PenTool, Hash, Trophy } from 'lucide-react';

interface MilestonesProgressProps {
  data: Record<string, any>;
}

export const MilestonesProgress: React.FC<MilestonesProgressProps> = ({ data }) => {
  // Helper to format keys like "cozy_hours" -> "Cozy Hours"
  const formatKey = (key: string) => {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Helper to pick icon
  const getIcon = (key: string) => {
      const lower = key.toLowerCase();
      if (lower.includes('hours') || lower.includes('time')) return <Clock size={14} />;
      if (lower.includes('review') || lower.includes('note')) return <PenTool size={14} />;
      if (lower.includes('achievement') || lower.includes('platinum')) return <Trophy size={14} />;
      return <Hash size={14} />;
  };

  const entries = Object.entries(data || {});

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={20} className="text-purple-500" />
        <h3 className="font-bold text-lg">Career Stats</h3>
      </div>

      {entries.length === 0 ? (
        <div className="text-sm text-muted-foreground italic p-4 text-center border-2 border-dashed border-border/50 rounded-lg">
            No tracked stats yet.
        </div>
      ) : (
        <div className="space-y-3">
            {entries.map(([key, value]) => {
                let displayValue: React.ReactNode = value;
                let displayLabel = formatKey(key);

                // Handle complex objects (e.g. from PlayerStatsService milestone updates)
                if (typeof value === 'object' && value !== null) {
                    if ('rank' in value) {
                        displayValue = `Rank ${value.rank}`;
                    } else {
                        // Fallback stringification if unknown object structure
                        try {
                           displayValue = JSON.stringify(value);
                        } catch {
                           displayValue = '-';
                        }
                    }
                    
                    // Override label if present in object
                    if ('label' in value && typeof value.label === 'string') {
                        displayLabel = value.label;
                    }
                } 
                // Handle primitive numbers
                else if (typeof value === 'number') {
                    displayValue = value.toLocaleString();
                }
                // Handle strings or other primitives
                else if (typeof value !== 'string' && !React.isValidElement(value)) {
                     displayValue = String(value);
                }

                return (
                    <div key={key} className="flex items-center justify-between text-sm group hover:bg-muted/30 p-2 rounded-lg transition-colors">
                        <div className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground transition-colors">
                            {getIcon(key)}
                            <span className="font-medium truncate max-w-[140px]" title={displayLabel}>{displayLabel}</span>
                        </div>
                        <span className="font-bold font-mono text-foreground">
                            {displayValue}
                        </span>
                    </div>
                );
            })}
        </div>
      )}
    </div>
  );
};
