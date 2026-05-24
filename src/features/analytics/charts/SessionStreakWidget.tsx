import React, { useMemo } from 'react';
import { Flame } from 'lucide-react';

interface SessionStreakWidgetProps {
  sessions: any[];
}

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

export const SessionStreakWidget: React.FC<SessionStreakWidgetProps> = ({ sessions }) => {
  const stats = useMemo(() => {
    const days = new Set<string>();
    sessions.forEach((session) => {
      if (session.start_time) days.add(dayKey(new Date(session.start_time)));
    });

    const today = new Date();
    let cursor = new Date(today);
    let streak = 0;

    if (!days.has(dayKey(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
    }

    while (days.has(dayKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    const recent = Array.from({ length: 14 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (13 - index));
      return {
        key: dayKey(date),
        label: date.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 1),
        active: days.has(dayKey(date)),
      };
    });

    return { streak, recent, activeDays: days.size };
  }, [sessions]);

  return (
    <div className="bg-card border rounded-xl p-6 shadow-sm h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Flame size={20} className="text-primary" />
        <h3 className="font-bold text-lg">Session Streak</h3>
      </div>

      <div className="flex-1 flex flex-col justify-center gap-5">
        <div>
          <div className="text-5xl font-black tracking-tight text-foreground">{stats.streak}</div>
          <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">current days</div>
        </div>

        <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>
          {stats.recent.map((day) => (
            <div key={day.key} className="space-y-1">
              <div
                className={`h-9 rounded-md border transition-colors ${day.active ? 'bg-primary border-primary' : 'bg-muted/30 border-border'}`}
                title={day.key}
              />
              <div className="text-[9px] text-muted-foreground text-center font-bold">{day.label}</div>
            </div>
          ))}
        </div>

        <div className="text-xs text-muted-foreground font-medium">
          {stats.activeDays} active days in the cached session history
        </div>
      </div>
    </div>
  );
};
