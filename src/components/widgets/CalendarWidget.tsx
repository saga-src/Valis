import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils/cn';

interface CalendarWidgetProps {
  selectedDate: string; // YYYY-MM-DD
  onSelect: (date: string) => void;
}

export default function CalendarWidget({ selectedDate, onSelect }: CalendarWidgetProps) {
  // Initialize view based on selected date or today
  const [viewDate, setViewDate] = useState(() => {
    if (selectedDate) {
      const d = new Date(selectedDate + 'T00:00:00'); // Fix timezone offset
      return isNaN(d.getTime()) ? new Date() : d;
    }
    return new Date();
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth(); // 0-11

  // Helpers
  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay(); // 0 = Sun

  const daysInMonth = getDaysInMonth(year, month);
  const startDay = getFirstDayOfMonth(year, month);

  // Month Navigation
  const changeMonth = (delta: number) => {
    setViewDate(new Date(year, month + delta, 1));
  };

  const handleDayClick = (day: number) => {
    // Construct YYYY-MM-DD manually to avoid timezone shifts
    const m = (month + 1).toString().padStart(2, '0');
    const d = day.toString().padStart(2, '0');
    const dateStr = `${year}-${m}-${d}`;
    onSelect(dateStr);
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    const [sY, sM, sD] = selectedDate.split('-').map(Number);
    return sY === year && sM === month + 1 && sD === day;
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div 
      className="calendar-widget-container absolute top-full mt-2 right-0 bg-popover text-popover-foreground border border-border rounded-xl shadow-2xl p-4 w-72 z-50 animate-in fade-in zoom-in-95 duration-100"
      onClick={(e) => e.stopPropagation()}
    >
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-muted rounded-lg transition-colors">
          <ChevronLeft size={16} />
        </button>
        <span className="font-bold text-sm">
          {monthNames[month]} {year}
        </span>
        <button onClick={() => changeMonth(1)} className="p-1 hover:bg-muted rounded-lg transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 mb-2">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="text-center text-xs font-bold text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty slots for start offset */}
        {Array.from({ length: startDay }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {/* Actual Days */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const selected = isSelected(day);
          const today = isToday(day);

          return (
            <button
              key={day}
              onClick={() => handleDayClick(day)}
              className={cn(
                "h-8 w-8 rounded-lg text-sm flex items-center justify-center transition-all",
                selected 
                  ? "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20" 
                  : today 
                    ? "bg-muted text-foreground font-bold border border-border"
                    : "text-foreground hover:bg-muted"
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}