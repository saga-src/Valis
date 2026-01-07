
import { format } from 'date-fns';

export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Helper to calculate true total playtime for a game object.
 * Handles legacy playtime as number (backward compat) or Array of objects (new structure).
 */
export const getTotalPlaytimeSeconds = (game: any) => {
  // Summing tracked session time
  const sessionSeconds = game.playtime_seconds || game.total_session_seconds || 0;
  
  let legacySeconds = 0;
  
  if (Array.isArray(game.legacy_playtime_seconds)) {
      // New Structure: [{ source, seconds }]
      legacySeconds = game.legacy_playtime_seconds.reduce((acc: number, curr: any) => acc + (curr.seconds || 0), 0);
  } else if (typeof game.legacy_playtime_seconds === 'number') {
      // Old Structure: simple integer
      legacySeconds = game.legacy_playtime_seconds;
  } else if (typeof game.legacy_playtime_seconds === 'string') {
      // Handle potential double-stringification or raw JSON
      try {
          const parsed = JSON.parse(game.legacy_playtime_seconds);
          if (Array.isArray(parsed)) {
              legacySeconds = parsed.reduce((acc: number, curr: any) => acc + (curr.seconds || 0), 0);
          } else if (typeof parsed === 'number') {
              legacySeconds = parsed;
          }
      } catch {
          legacySeconds = 0;
      }
  }

  return sessionSeconds + legacySeconds;
};

/**
 * Full Format (e.g. "12h 30m 45s")
 * Used in Game Details, Lists, and anywhere precision matters.
 * Always shows seconds.
 */
export const formatPlaytime = (totalSeconds: number): string => {
  if (!totalSeconds) return "0s";

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const parts = [];
  
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  // Always show seconds in full mode, even if 0 (unless total is 0, handled above)
  parts.push(`${seconds}s`);

  return parts.join(' ');
};

/**
 * Compact Format (e.g. "12h 30m")
 * Used ONLY for Game Cards to prevent layout overflow.
 * Hides seconds if hours/minutes exist.
 */
export const formatCardTime = (totalSeconds: number): string => {
  if (!totalSeconds) return "0m";

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  // 1. If 100+ hours, just show hours (e.g. "188h") - Very clean
  if (hours >= 100) {
      return `${hours}h`; 
  }

  // 2. If 1+ hours, show hours + minutes (e.g. "12h 30m")
  if (hours > 0) {
      return `${hours}h ${minutes}m`;
  }
  
  // 3. If minutes exist, show minutes (e.g. "45m")
  if (minutes > 0) {
      return `${minutes}m`;
  }

  // 4. Otherwise show seconds (e.g. "30s")
  return `${seconds}s`;
};

export function formatDuration(ms: number): string {
  return formatPlaytime(ms / 1000);
}

export function formatSessionDate(isoString: string): string {
  return format(new Date(isoString), 'MMM d, yyyy h:mm a');
}
