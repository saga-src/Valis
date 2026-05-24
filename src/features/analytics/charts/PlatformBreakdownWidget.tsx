import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Store } from 'lucide-react';
import { CUSTOM_PLATFORM_DATA } from '../../../types/index';
import { STORE_NAMES } from '../../library/utils/libraryUtils';

interface PlatformBreakdownWidgetProps {
  library: any[];
  sessions: any[];
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--primary))',
];

const parseArray = (value: any) => {
  try {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return JSON.parse(value || '[]');
  } catch {}
  return [];
};

const getPlatformName = (game: any, id: number) => {
  if (STORE_NAMES[id]) return STORE_NAMES[id];
  if (CUSTOM_PLATFORM_DATA[id]) return CUSTOM_PLATFORM_DATA[id].name;
  const platforms = parseArray(game.platforms);
  const match = platforms.find((platform: any) => Number(platform.id) === id);
  return match?.name || match?.abbreviation || `Platform ${id}`;
};

export const PlatformBreakdownWidget: React.FC<PlatformBreakdownWidgetProps> = ({ library, sessions }) => {
  const { data, totalHours } = useMemo(() => {
    const playtimeByGame = new Map<string, number>();
    sessions.forEach((session) => {
      const seconds = Number(session.duration_seconds || 0) || Number(session.duration_minutes || 0) * 60;
      playtimeByGame.set(String(session.game_id), (playtimeByGame.get(String(session.game_id)) || 0) + seconds);
    });

    const totals = new Map<string, { games: number; seconds: number }>();
    library.forEach((game) => {
      const ids = parseArray(game.owned_platform_ids);
      const primary = Number(ids[0] || game.primary_platform_id || 0);
      const name = primary ? getPlatformName(game, primary) : 'Unspecified';
      const current = totals.get(name) || { games: 0, seconds: 0 };
      current.games += 1;
      current.seconds += playtimeByGame.get(String(game.id)) || 0;
      totals.set(name, current);
    });

    const rows = Array.from(totals.entries())
      .map(([name, value]) => ({
        name,
        games: value.games,
        hours: Math.round((value.seconds / 3600) * 10) / 10,
      }))
      .sort((a, b) => b.games - a.games)
      .slice(0, 6);

    return {
      data: rows,
      totalHours: rows.reduce((sum, row) => sum + row.hours, 0),
    };
  }, [library, sessions]);

  return (
    <div className="bg-card border rounded-xl p-6 shadow-sm h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Store size={20} className="text-primary" />
        <h3 className="font-bold text-lg">Platform Breakdown</h3>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-[1fr_12rem] gap-4">
        <div className="min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="games" nameKey="name" innerRadius="48%" outerRadius="78%" paddingAngle={3} stroke="none">
                {data.map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 8 }}
                formatter={(value, _name, props) => [`${value} games, ${props.payload.hours}h`, props.payload.name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-2 overflow-hidden">
          {data.map((item, index) => (
            <div key={item.name} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="font-bold text-muted-foreground truncate">{item.name}</span>
              </span>
              <span className="font-mono text-foreground">{item.games}</span>
            </div>
          ))}
          <div className="pt-3 mt-3 border-t border-border text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
            {Math.round(totalHours)}h tracked here
          </div>
        </div>
      </div>
    </div>
  );
};
