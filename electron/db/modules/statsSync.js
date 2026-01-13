import { db } from '../client.js';

// ✅ GRANULAR MAPPING (15 Archetypes)
const GENRE_NORMALIZATION = {
    // --- RPG ---
    "Role-playing (RPG)": "RPG",
    "RPG": "RPG",

    // --- Action ---
    "Hack and slash/Beat 'em up": "Action",
    "Action": "Action",

    // --- Fighting ---
    "Fighting": "Fighting",

    // --- Adventure ---
    "Adventure": "Adventure",

    // --- Narrative (Visual Novel + Point & Click) ---
    "Visual Novel": "Narrative",
    "Point-and-click": "Narrative",

    // --- Strategy (Pure RTS/TBS) ---
    "Strategy": "Strategy",
    "Real Time Strategy (RTS)": "Strategy",
    "Turn-based strategy (TBS)": "Strategy",

    // --- MOBA ---
    "MOBA": "MOBA",

    // --- Tactical ---
    "Tactical": "Tactical",

    // --- Card & Board ---
    "Card & Board Game": "Card & Board",

    // --- Shooter ---
    "Shooter": "Shooter",

    // --- Simulation ---
    "Simulator": "Simulation",
    "Simulation": "Simulation",

    // --- Sports (Includes Racing) ---
    "Sport": "Sports",
    "Sports": "Sports",
    "Racing": "Sports",

    // --- Platform ---
    "Platform": "Platform",

    // --- Puzzle ---
    "Puzzle": "Puzzle",
    "Quiz/Trivia": "Puzzle",

    // --- Arcade ---
    "Arcade": "Arcade",
    "Pinball": "Arcade",
    "Music": "Arcade"
};

/**
 * Core Engine for Valis Cloud Sync (v1.0.2)
 * - Uses granular normalization (15 Archetypes).
 * - Aggregates Sessions + Legacy Time + Achievements.
 * - Respects Frontend Categories: 'playtime', 'genre', 'achievements', 'platinum'
 */
export async function getProfileSyncStats() {
  console.log('[SyncEngine] Starting granular normalized aggregation...');
  try {
    // --- PREP: Helper for Aggregation ---
    // Key: "category|sub_category|period_type|period_key" -> Value: score
    const aggregator = new Map();

    const addScore = (category, sub_category, period_type, period_key, amount) => {
        if (!amount || amount <= 0) return;
        const key = `${category}|${sub_category}|${period_type}|${period_key}`;
        aggregator.set(key, (aggregator.get(key) || 0) + amount);
    };

    // --- STEP 1: Fetch Metadata (Game -> Normalized Genres) ---
    const allGames = await db.selectFrom('games').select(['id', 'genres']).execute();
    const gameGenreMap = new Map();
    allGames.forEach(g => {
        try {
            const parsed = typeof g.genres === 'string' ? JSON.parse(g.genres) : g.genres;
            if (Array.isArray(parsed)) {
                // Apply Granular Normalization and deduplicate
                const normalizedGenres = new Set();
                parsed.forEach(p => {
                    const rawName = p.name || p;
                    if (rawName) {
                        const cleanName = GENRE_NORMALIZATION[rawName];
                        if (cleanName) normalizedGenres.add(cleanName);
                    }
                });
                gameGenreMap.set(g.id, Array.from(normalizedGenres));
            }
        } catch (e) {}
    });

    // --- STEP 2: Library Stats (Legacy Time & Counts) ---
    const libraryRows = await db.selectFrom('library')
        .select(['game_id', 'playtime_seconds', 'legacy_playtime_seconds', 'status'])
        .execute();

    const profileStats = { total_playtime_seconds: 0, collection_count: 0, campaigns_beat: 0, perfect_games: 0 };

    libraryRows.forEach(row => {
        const sessionTime = Number(row.playtime_seconds) || 0;
        
        // Robust Legacy Parser
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

        // Profile Totals
        profileStats.total_playtime_seconds += (sessionTime + legacyTime);
        profileStats.collection_count += 1;
        if (['Beat', 'Completed'].includes(row.status)) profileStats.campaigns_beat += 1;
        if (row.status === 'Completed') profileStats.perfect_games += 1;

        // Add Legacy Time to "All Time" Buckets
        if (legacyTime > 0) {
            addScore('playtime', 'global', 'all_time', 'total', legacyTime);
            const genres = gameGenreMap.get(row.game_id) || [];
            genres.forEach(genre => {
                addScore('playtime', genre, 'all_time', 'total', legacyTime);
            });
        }
    });

    // --- STEP 3: Session History (Playtime over Time) ---
    const sessions = await db.selectFrom('sessions')
        .select(['duration_seconds', 'start_time', 'game_id'])
        .execute();

    sessions.forEach(session => {
        const date = new Date(session.start_time);
        if (isNaN(date.getTime())) return;
        const duration = Number(session.duration_seconds) || 0;
        if (duration <= 0) return;

        const genres = gameGenreMap.get(session.game_id) || [];
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const weekKey = `${date.getFullYear()}-W${getWeekNumber(date).toString().padStart(2, '0')}`;

        // Global Playtime
        addScore('playtime', 'global', 'all_time', 'total', duration);
        addScore('playtime', 'global', 'month', monthKey, duration);
        addScore('playtime', 'global', 'week', weekKey, duration);

        // Genre Playtime (Normalized)
        genres.forEach(genre => {
            addScore('playtime', genre, 'all_time', 'total', duration);
            addScore('playtime', genre, 'month', monthKey, duration);
            addScore('playtime', genre, 'week', weekKey, duration);
        });
    });

    // --- STEP 4: Achievement History (Trophies over Time) ---
    const achievements = await db.selectFrom('achievements')
        .innerJoin('achievement_progress', (join) => 
            join.onRef('achievements.id', '=', 'achievement_progress.achievement_id')
                .onRef('achievements.game_id', '=', 'achievement_progress.game_id')
        )
        .select(['achievements.id', 'achievements.game_id', 'achievement_progress.unlocked_at'])
        .where('achievements.unlocked', '=', 1)
        .execute();

    achievements.forEach(ach => {
        if (!ach.unlocked_at) return;
        const date = new Date(ach.unlocked_at);
        if (isNaN(date.getTime())) return; 

        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const weekKey = `${date.getFullYear()}-W${getWeekNumber(date).toString().padStart(2, '0')}`;

        // Global Trophies (Category: 'achievements')
        addScore('achievements', 'global', 'all_time', 'total', 1);
        addScore('achievements', 'global', 'month', monthKey, 1);
        addScore('achievements', 'global', 'week', weekKey, 1);
    });

    // --- STEP 5: Transform for Supabase ---
    const leaderboard_entries = [];
    for (const [compositeKey, score] of aggregator.entries()) {
        const [category, sub_category, period_type, period_key] = compositeKey.split('|');
        leaderboard_entries.push({
            category,
            sub_category,
            period_type,
            period_key,
            score
        });
    }

    // Append Static Stats (Beats/Platinum - currently only tracked as totals)
    leaderboard_entries.push({ category: 'beats', sub_category: 'global', period_type: 'all_time', period_key: 'total', score: profileStats.campaigns_beat });
    leaderboard_entries.push({ category: 'platinum', sub_category: 'global', period_type: 'all_time', period_key: 'total', score: profileStats.perfect_games });

    console.log(`[SyncEngine] Granular aggregation complete. Generated ${leaderboard_entries.length} rows.`);

    return {
        stats: { ...profileStats, last_synced_at: new Date().toISOString() },
        leaderboard_entries
    };

  } catch (error) {
    console.error('[SyncEngine] Critical Failure:', error);
    throw error;
  }
}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
