
import { PlayerStatsService } from '../../social/services/PlayerStatsService';
import { CUSTOM_PLATFORM_DATA } from '../../../types/index';

export const calculateAndSyncObsession = async (userId: string) => {
  // Guard clause for web mode (no API)
  if (!window.api || !window.api.getRecentSessions) return;

  try {
    // 1. Fetch sessions from last 30 days
    const sessions = await window.api.getRecentSessions(30);
    
    if (!sessions || sessions.length === 0) {
        // Clear obsession if no recent activity
        await PlayerStatsService.updateObsession(userId, null as any); 
        return;
    }

    // 2. Aggregate Duration by Game & Track Platforms
    const totals: Record<string, number> = {};
    const lastPlayed: Record<string, string> = {};
    const playedPlatformIds: Record<string, Set<number>> = {};

    sessions.forEach((s: any) => {
        // Handle database schema variations (legacy minutes vs new seconds)
        const seconds = s.duration_seconds !== undefined 
            ? s.duration_seconds 
            : (s.duration_minutes || 0) * 60;
            
        const gid = String(s.game_id);
        
        totals[gid] = (totals[gid] || 0) + seconds;
        
        // Track latest session date
        const sTime = s.start_time; 
        const sDate = new Date(sTime);
        
        if (!lastPlayed[gid] || sDate > new Date(lastPlayed[gid])) {
            lastPlayed[gid] = sDate.toISOString();
        }

        // Track Played Platforms (for filtering display)
        if (s.platform_id) {
            if (!playedPlatformIds[gid]) playedPlatformIds[gid] = new Set();
            playedPlatformIds[gid].add(Number(s.platform_id));
        }
    });

    // 3. Find Winner
    let maxSeconds = 0;
    let winnerId: string | null = null;

    Object.entries(totals).forEach(([gid, seconds]) => {
        if (seconds > maxSeconds) {
            maxSeconds = seconds;
            winnerId = gid;
        }
    });

    // 4. Threshold Check (2 Hours = 7200 Seconds)
    if (winnerId && maxSeconds > 7200) {
        // Fetch Game Details
        const game = await window.api.getGameById(winnerId);
        
        if (game) {
            const hours = Math.round((maxSeconds / 3600) * 10) / 10;
            
            // Parse IGDB platforms safely
            let allPlatforms = [];
            try {
                allPlatforms = typeof game.platforms === 'string' ? JSON.parse(game.platforms) : (game.platforms || []);
            } catch (e) {
                console.warn('[Obsession] Failed to parse platforms', e);
            }

            // Filter or Construct Display Platforms
            let displayPlatforms = allPlatforms;
            const relevantIds = playedPlatformIds[winnerId];

            if (relevantIds && relevantIds.size > 0) {
                 const filtered: any[] = [];
                 relevantIds.forEach(id => {
                     // 1. Check Custom Stores (Steam, Epic, etc.)
                     if (CUSTOM_PLATFORM_DATA[id]) {
                         filtered.push(CUSTOM_PLATFORM_DATA[id]);
                     } else {
                         // 2. Check IGDB Metadata (Consoles)
                         const match = allPlatforms.find((p: any) => p.id === id);
                         if (match) filtered.push(match);
                     }
                 });
                 
                 // Apply filter only if we successfully matched platforms
                 // (Fallback to all if user played on an ID we can't resolve, though unlikely)
                 if (filtered.length > 0) {
                     displayPlatforms = filtered;
                 }
            }

            // Sync to Cloud
            await PlayerStatsService.updateObsession(userId, {
                game_id: String(game.id),
                title: game.title || game.name || 'Unknown Game',
                cover: game.cover_url || '',
                hours_last_30_days: hours,
                last_played: lastPlayed[winnerId] || new Date().toISOString(),
                platforms: displayPlatforms
            });
            console.log(`[Obsession] Synced: ${game.title || game.name} (${hours}h) on ${displayPlatforms.map((p: any) => p.name || p.abbreviation).join(', ')}`);
        }
    } else {
        // No game met threshold, clear it
        await PlayerStatsService.updateObsession(userId, null as any);
        console.log('[Obsession] Cleared (No game > 2h played recently).');
    }

  } catch (error) {
    console.error('[Obsession] Calculation failed:', error);
  }
};
