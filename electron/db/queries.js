import { db } from './client.js';

// ⚡ Re-exporting all modules to keep the API clean and compatible
export * from './modules/games.js';
export * from './modules/sessions.js';
export * from './modules/achievements.js';
export * from './modules/tags.js';
export * from './modules/settings.js';
export * from './modules/utils.js';
export * from './modules/gamification.js';

/**
 * Aggregates all stats required for Cloud Profile & Leaderboards.
 * Calculates totals (legacy + session) and period-based scores (weekly/monthly).
 * Uses JS aggregation to avoid SQLite driver complexity with calculated columns.
 */
export async function getProfileSyncStats() {
  // 1. Fetch raw data needed for stats
  const libraryRows = await db.selectFrom('library')
    .select(['playtime_seconds', 'legacy_playtime_seconds', 'status'])
    .execute();

  // 2. Aggregate in JavaScript (Robust & Safe)
  const totals = libraryRows.reduce((acc, row) => {
    const sessionTime = Number(row.playtime_seconds) || 0;
    
    // Handle legacy_playtime_seconds (can be number or JSON string)
    let legacyTime = 0;
    const rawLegacy = row.legacy_playtime_seconds;
    if (typeof rawLegacy === 'number') {
        legacyTime = rawLegacy;
    } else if (typeof rawLegacy === 'string' && rawLegacy.trim() !== '') {
        try {
            const parsed = JSON.parse(rawLegacy);
            if (Array.isArray(parsed)) {
                legacyTime = parsed.reduce((sum, curr) => sum + (Number(curr.seconds) || 0), 0);
            } else if (typeof parsed === 'number') {
                legacyTime = parsed;
            }
        } catch {
            legacyTime = 0;
        }
    }

    acc.total_playtime_seconds += (sessionTime + legacyTime);
    acc.collection_count += 1;

    if (['Beat', 'Completed'].includes(row.status)) {
        acc.campaigns_beat += 1;
    }
    if (row.status === 'Completed') {
        acc.perfect_games += 1;
    }
    return acc;
  }, {
    total_playtime_seconds: 0,
    collection_count: 0,
    campaigns_beat: 0,
    perfect_games: 0
  });

  // 3. Leaderboard Periods (Weekly/Monthly)
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday start

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Fetch raw sessions for JS processing
  const sessions = await db.selectFrom('sessions')
    .select(['duration_seconds', 'start_time'])
    .execute();

  let weeklySeconds = 0;
  let monthlySeconds = 0;

  sessions.forEach(session => {
    const date = new Date(session.start_time);
    const duration = Number(session.duration_seconds) || 0;
    if (date >= startOfWeek) weeklySeconds += duration;
    if (date >= startOfMonth) monthlySeconds += duration;
  });

  // 4. Construct Payload
  return {
    stats: {
      ...totals,
      last_synced_at: new Date().toISOString()
    },
    leaderboard_entries: [
      { 
        category: 'playtime', 
        period_type: 'all_time', 
        period_key: 'total', 
        score: totals.total_playtime_seconds 
      },
      { 
        category: 'playtime', 
        period_type: 'monthly', 
        period_key: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`, 
        score: monthlySeconds 
      },
      { 
        category: 'playtime', 
        period_type: 'weekly', 
        period_key: `${now.getFullYear()}-W${getWeekNumber(now)}`, 
        score: weeklySeconds 
      }
    ]
  };
}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}