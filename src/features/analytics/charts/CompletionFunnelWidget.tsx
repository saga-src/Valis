import React, { useMemo } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ListChecks } from 'lucide-react';

interface CompletionFunnelWidgetProps {
  library: any[];
}

const FUNNEL = [
  { key: 'Backlog', label: 'Backlog', color: 'var(--status-backlog)' },
  { key: 'Playing', label: 'Playing', color: 'var(--status-playing)' },
  { key: 'Beat', label: 'Beat', color: 'var(--status-beat)' },
  { key: 'Completed', label: 'Completed', color: 'var(--status-completed)' },
];

export const CompletionFunnelWidget: React.FC<CompletionFunnelWidgetProps> = ({ library }) => {
  const data = useMemo(() => {
    const counts = new Map(FUNNEL.map(item => [item.key, 0]));
    library.forEach((game) => {
      const status = game.status || 'Backlog';
      if (counts.has(status)) counts.set(status, (counts.get(status) || 0) + 1);
    });

    const total = library.length || 1;
    return FUNNEL.map((item) => ({
      ...item,
      count: counts.get(item.key) || 0,
      percent: Math.round(((counts.get(item.key) || 0) / total) * 100),
    }));
  }, [library]);

  return (
    <div className="bg-card border rounded-xl p-6 shadow-sm h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <ListChecks size={20} className="text-primary" />
        <h3 className="font-bold text-lg">Completion Funnel</h3>
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 28, left: 16, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="label"
              width={72}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontWeight: 700 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 8 }}
              formatter={(value, _name, props) => [`${value} games (${props.payload.percent}%)`, props.payload.label]}
            />
            <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={24}>
              {data.map((entry) => (
                <Cell key={entry.key} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
