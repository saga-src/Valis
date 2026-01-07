import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';

export const formatActivityTime = (dateString: string) => {
  const date = new Date(dateString);

  // 1. If today: "2 hours ago"
  if (isToday(date)) {
    return formatDistanceToNow(date, { addSuffix: true });
  }

  // 2. If yesterday: "Yesterday at 14:30"
  if (isYesterday(date)) {
    return `Yesterday at ${format(date, 'HH:mm')}`;
  }

  // 3. Older: "28/12/2025 at 14:30"
  return format(date, 'dd/MM/yyyy at HH:mm');
};
