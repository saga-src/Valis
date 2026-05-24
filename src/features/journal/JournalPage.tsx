import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useJournal, Session } from './useJournal';
import { BookOpen, CalendarOff, Calendar, X } from 'lucide-react';
import { HealthMonitor } from './HealthMonitor';
import { JournalEntry } from './JournalEntry';
import CalendarWidget from '../../components/widgets/CalendarWidget';
import { cn } from '../../lib/utils/cn';
import { format } from 'date-fns';

// Helper for "Today/Yesterday" headers
const formatDateHeader = (dateStr: string) => {
  // Append time to ensure local date parsing from YYYY-MM-DD string
  const date = new Date(dateStr + 'T00:00:00'); 
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  // Normalize to start of day for comparison
  const d = new Date(date); d.setHours(0,0,0,0);
  const t = new Date(today); t.setHours(0,0,0,0);
  const y = new Date(yesterday); y.setHours(0,0,0,0);

  if (d.getTime() === t.getTime()) return 'Today';
  if (d.getTime() === y.getTime()) return 'Yesterday';
  
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};

export const JournalPage: React.FC = () => {
  const [filterDate, setFilterDate] = useState(''); // Format: YYYY-MM-DD
  const [showCalendar, setShowCalendar] = useState(false);
  const { sessions, healthSessions, games, loading, loadingMore, hasMore, loadMore } = useJournal(filterDate);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Group sessions by date
  const dailySessions = useMemo(() => {
    const groups: Record<string, Session[]> = {};
    sessions.forEach(session => {
      const dateKey = format(new Date(session.start_time), 'yyyy-MM-dd');
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(session);
    });
    return groups;
  }, [sessions]);

  const visibleDates = Object.keys(dailySessions).sort((a, b) => b.localeCompare(a));

  useEffect(() => {
    if (!hasMore || loadingMore) return;

    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMore();
    }, { rootMargin: '360px 0px' });

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadMore, loadingMore, visibleDates.length]);

  if (loading) return (
    <div className="p-12 flex justify-center h-full items-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto pb-20">
      
      {/* Backdrop for Calendar */}
      {showCalendar && (
        <div 
          className="fixed inset-0 z-40 bg-transparent" 
          onClick={() => setShowCalendar(false)} 
        />
      )}

      {/* Header with Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
            <BookOpen className="text-primary" size={32} /> Journal
            </h1>
            <p className="text-muted-foreground mt-1">Your gaming history, day by day.</p>
        </div>

        {/* Date Filter */}
        <div className="relative z-50">
           <div className="flex items-center gap-2 bg-card border border-border rounded-lg p-1 pr-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all">
               {/* Trigger Button */}
               <button 
                  onClick={() => setShowCalendar(!showCalendar)}
                  className={cn(
                    "p-2 rounded-md transition-colors",
                    showCalendar ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  title="Open Calendar"
               >
                  <Calendar size={16} />
               </button>

               {/* Manual Input */}
               <input 
                 type="date" 
                 value={filterDate}
                 onChange={(e) => setFilterDate(e.target.value)}
                 className="bg-transparent border-none focus:ring-0 text-sm font-medium text-foreground outline-none py-1 cursor-pointer"
                 onClick={() => setShowCalendar(false)} 
               />

               {/* Clear Button */}
               {filterDate && (
                 <button 
                   onClick={() => setFilterDate('')}
                   className="p-1 hover:bg-destructive/10 hover:text-destructive rounded-full text-muted-foreground transition-colors"
                   title="Clear filter"
                 >
                   <X size={14} />
                 </button>
               )}
            </div>

            {/* Calendar Popover */}
            {showCalendar && (
                <CalendarWidget 
                    selectedDate={filterDate} 
                    onSelect={(date) => {
                      setFilterDate(date);
                      setShowCalendar(false);
                    }}
                />
            )}
        </div>
      </div>

      {/* Health Monitor Widget */}
      <HealthMonitor sessions={healthSessions} />
      
      {visibleDates.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed rounded-2xl bg-muted/10 opacity-60">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <CalendarOff className="text-muted-foreground" size={32} />
          </div>
          <h3 className="text-xl font-bold text-muted-foreground">
             {filterDate ? `No sessions found on ${filterDate}` : "No entries yet"}
          </h3>
          {!filterDate && (
             <p className="text-sm text-muted-foreground mt-2">Start playing games via Quick Play or the Library to populate your journal.</p>
          )}
          {filterDate && (
              <button onClick={() => setFilterDate('')} className="mt-2 text-sm text-primary hover:underline">
                Clear Date Filter
              </button>
           )}
        </div>
      ) : (
        <div className="space-y-8">
          {visibleDates.map((date) => (
            <div key={date} className="relative animate-in slide-in-from-bottom-2 duration-500">
              
              {/* Sticky Header */}
              <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md py-4 mb-4 border-b border-border/50">
                 <h3 className="text-xl font-bold text-foreground capitalize flex items-center gap-2">
                    {formatDateHeader(date)}
                    {/* Show full date if Today/Yesterday */}
                    {(formatDateHeader(date) === 'Today' || formatDateHeader(date) === 'Yesterday') && (
                       <span className="text-sm font-normal text-muted-foreground hidden sm:inline">
                          ({new Date(date + 'T00:00:00').toLocaleDateString()})
                       </span>
                    )}
                 </h3>
              </div>

              {/* Session Timeline Items */}
              <div>
                {dailySessions[date].map((session) => (
                  <JournalEntry key={session.id} session={session} game={games[session.game_id]} />
                ))}
              </div>
            </div>
          ))}

          {hasMore && (
            <div ref={loadMoreRef} className="flex justify-center py-6">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-4 py-2 rounded-lg border border-border bg-card text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-60 disabled:cursor-wait transition-colors"
              >
                {loadingMore ? 'Loading sessions...' : 'Load more sessions'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
