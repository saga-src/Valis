import { rawDb, db } from '../client.js';
import { PROGRESSION_TREE } from '../../lib/internal_milestones.js';

// --- Metrics Calculation ---

export async function getMetrics() {
  const metrics = {};

  // --- 1. THE ARCHIVIST ---
  
  // Collector: Total Games
  const gamesRes = rawDb.prepare('SELECT count(*) as count FROM library').get();
  metrics.total_games = gamesRes ? gamesRes.count : 0;

  // Taxonomist: Tagged Sessions (Notes not empty)
  const taggedRes = rawDb.prepare("SELECT count(*) as count FROM sessions WHERE notes IS NOT NULL AND notes != '[]' AND notes != ''").get();
  metrics.tagged_sessions = taggedRes ? taggedRes.count : 0;

  // Integrator: Distinct Sources (Unique store_ids)
  const sourcesRes = rawDb.prepare('SELECT count(distinct store_id) as count FROM library_platforms WHERE store_id IS NOT NULL').get();
  metrics.distinct_sources = sourcesRes ? sourcesRes.count : 0;

  // Purger: Dropped Games
  const droppedRes = rawDb.prepare("SELECT count(*) as count FROM library WHERE status = 'Dropped'").get();
  metrics.dropped_games = droppedRes ? droppedRes.count : 0;

  // Fabricator: Manual Adds (Count from user_stats incremented on manual add)
  const fabRes = rawDb.prepare("SELECT value FROM user_stats WHERE key = 'manual_games_added'").get();
  metrics.manual_games_added = fabRes ? fabRes.value : 0;

  // Librarian: Games with Tags (Using junction table)
  try {
    const tagsRes = rawDb.prepare("SELECT count(distinct game_id) as count FROM game_library_tags").get();
    metrics.games_with_tags = tagsRes ? tagsRes.count : 0;
  } catch (e) {
    metrics.games_with_tags = 0; // Fallback if table missing during migration
  }

  // --- 2. THE CRITIC ---

  // Fetch all metadata to parse in JS (Handles Journalist, Analyst, Pundit)
  const metaRows = rawDb.prepare("SELECT review_metadata FROM library WHERE review_metadata IS NOT NULL AND review_metadata != '' AND review_metadata != 'null'").all();

  let journalistCount = 0; // Text Reviews
  let analystCount = 0;    // Total Reviews (Rating OR Score)
  let punditCount = 0;     // Critical Mode

  // Also fetch star ratings for Analyst backfill
  const ratingRows = rawDb.prepare("SELECT count(*) as count FROM library WHERE rating > 0").get();
  let starRatingCount = ratingRows ? ratingRows.count : 0; 

  metaRows.forEach(row => {
    try {
      const meta = JSON.parse(row.review_metadata);
      if (meta && typeof meta === 'object') {
        // Journalist: Check for text notes
        if (meta.notes && typeof meta.notes === 'string' && meta.notes.trim().length > 0) {
          journalistCount++;
        }
        // Pundit: Check for Critical Method
        if (meta.method === 'CRITICAL') {
          punditCount++;
        }
        // Analyst: Check if Calculated Average exists in metadata
        if (meta.calculated_average > 0) {
          analystCount++;
        }
      }
    } catch (e) {}
  });

  metrics.text_reviews = journalistCount;
  metrics.critical_reviews = punditCount;
  // Analyst counts both Metadata Reviews AND Star Ratings (Max to avoid double counting if they overlap, or sum if distinct? Usually overlap. We'll use the higher number to be safe).
  metrics.total_reviews = Math.max(analystCount, starRatingCount);

  // Broadcaster: Shared Cards (User Stat)
  const sharedRes = rawDb.prepare("SELECT value FROM user_stats WHERE key = 'metric_shared_cards'").get();
  metrics.shared_cards = sharedRes ? sharedRes.value : 0;


  // --- 3. THE COMPLETIONIST ---

  // Finisher: Games Beat
  const beatRes = rawDb.prepare("SELECT count(*) as count FROM library WHERE status = 'Beat'").get();
  metrics.games_beat = beatRes ? beatRes.count : 0;

  // Perfectionist: Games Completed (Includes 100% alias)
  const completedRes = rawDb.prepare("SELECT count(*) as count FROM library WHERE status IN ('Completed', '100%')").get();
  metrics.games_completed = completedRes ? completedRes.count : 0;

  // Hoarder: Total Achievements
  const achRes = rawDb.prepare("SELECT count(*) as count FROM achievements WHERE unlocked = 1").get();
  metrics.total_achievements = achRes ? achRes.count : 0;

  // Titan: Long Games Beaten (> 30 Hours / 108000 seconds)
  const titanRes = rawDb.prepare("SELECT count(*) as count FROM library WHERE status IN ('Beat', 'Completed', '100%') AND playtime_seconds >= 108000").get();
  metrics.long_games_beaten = titanRes ? titanRes.count : 0;

  // Veteran: Post-Game Sessions (Count from user_stats incremented on save)
  const vetRes = rawDb.prepare("SELECT value FROM user_stats WHERE key = 'veteran_sessions'").get();
  metrics.post_game_sessions = vetRes ? vetRes.value : 0;

  // Ascendant: Total XP
  const xpRes = rawDb.prepare("SELECT value FROM user_stats WHERE key = 'total_xp'").get();
  metrics.total_xp = xpRes ? xpRes.value : 0;


  // --- 4. THE TIMEKEEPER ---

  // Diver: Longest Session (Hours)
  const sessionMaxRes = rawDb.prepare("SELECT max(duration_seconds) as max FROM sessions").get();
  metrics.longest_session = sessionMaxRes && sessionMaxRes.max ? sessionMaxRes.max / 3600 : 0;

  // Loyalist: Max Hours on One Game (VALIS ONLY - Removed legacy_playtime_seconds)
  const maxPlaytimeRes = rawDb.prepare("SELECT max(playtime_seconds) as max FROM library").get();
  metrics.max_hours_one_game = maxPlaytimeRes && maxPlaytimeRes.max ? maxPlaytimeRes.max / 3600 : 0;

  // Operator: Launcher Starts (Count from user_stats incremented on launch)
  const launcherRes = rawDb.prepare("SELECT value FROM user_stats WHERE key = 'launcher_starts'").get();
  metrics.launcher_starts = launcherRes ? launcherRes.value : 0;

  // Eclectic: Unique Genres (Valis Playtime Only)
  // Only counts genres from games that have > 0 seconds of tracked playtime.
  const genreRows = rawDb.prepare(`
    SELECT g.genres 
    FROM library l 
    JOIN games g ON l.game_id = g.id 
    WHERE l.playtime_seconds > 0 
    AND g.genres IS NOT NULL
  `).all();

  const uniqueGenreIds = new Set();
  genreRows.forEach(row => {
    try {
      const gList = JSON.parse(row.genres);
      if (Array.isArray(gList)) {
        gList.forEach(genre => {
          // IGDB genres are objects { id, name }, we track unique IDs
          if (genre.id) uniqueGenreIds.add(genre.id);
        });
      }
    } catch (e) {
      // Ignore malformed JSON
    }
  });
  metrics.unique_genres = uniqueGenreIds.size;

  // Regular: Current Streak (Existing Logic)
  const sessionDatesRes = rawDb.prepare("SELECT start_time FROM sessions ORDER BY start_time DESC").all();
  if (sessionDatesRes.length === 0) {
    metrics.current_streak = 0;
  } else {
    const dates = sessionDatesRes.map(row => new Date(row.start_time).toISOString().split('T')[0]);
    const uniqueDates = [...new Set(dates)];
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) {
      metrics.current_streak = 0;
    } else {
      let streak = 1;
      let currentDate = new Date(uniqueDates[0]);
      for (let i = 1; i < uniqueDates.length; i++) {
        const prevDateStr = uniqueDates[i];
        const expectedPrev = new Date(currentDate);
        expectedPrev.setDate(expectedPrev.getDate() - 1);
        const expectedPrevStr = expectedPrev.toISOString().split('T')[0];
        if (prevDateStr === expectedPrevStr) {
          streak++;
          currentDate = expectedPrev;
        } else {
          break;
        }
      }
      metrics.current_streak = streak;
    }
  }

  return metrics;
}

// --- Sync & Unlock Logic ---

export async function syncProgress() {
  const metrics = await getMetrics();
  const newUnlocks = [];
  let totalXP = 0;

  // Fetch already unlocked
  const unlockedRows = rawDb.prepare("SELECT id FROM unlocked_tiers").all();
  const unlockedIds = new Set(unlockedRows.map(r => r.id));

  // Iterate Tree
  for (const archetype of PROGRESSION_TREE) {
    for (const discipline of archetype.disciplines) {
      const currentVal = metrics[discipline.metric] || 0;
      
      for (const tier of discipline.tiers) {
        const tierId = `${discipline.id}_${tier.level}`;
        
        // Check if condition met
        if (currentVal >= tier.target) {
          // Add to XP total regardless of new/old (assuming XP is cumulative based on standing)
          totalXP += tier.xp;

          // If not recorded, unlock it
          if (!unlockedIds.has(tierId)) {
            const unlockData = {
              id: tierId,
              archetype_id: archetype.id,
              discipline_id: discipline.id,
              tier_level: tier.level,
              unlocked_at: new Date().toISOString()
            };
            
            await db.insertInto('unlocked_tiers').values(unlockData).execute();
            unlockedIds.add(tierId); // Mark processed
            
            newUnlocks.push({
              ...tier,
              archetype_name: archetype.name,
              discipline_name: discipline.name,
              id: tierId,
              maxRanks: discipline.tiers.length,
              icon: discipline.icon
            });
          }
        }
      }
    }
  }

  // ⚡ Add Playtime XP (Local Guest Support)
  const playtimeRes = rawDb.prepare("SELECT value FROM user_stats WHERE key = 'playtime_xp'").get();
  const playtimeXP = playtimeRes ? playtimeRes.value : 0;
  totalXP += playtimeXP;

  // Update User Stats (Total XP)
  const xpEntry = {
    key: 'total_xp',
    value: totalXP,
    updated_at: new Date().toISOString()
  };
  
  await db.insertInto('user_stats')
    .values(xpEntry)
    .onConflict(oc => oc.column('key').doUpdateSet({
      value: totalXP,
      updated_at: new Date().toISOString()
    }))
    .execute();

  return { metrics, newUnlocks, totalXP };
}

// Helper to manually increment a stat (e.g. Shared Cards)
export async function incrementUserStat(key, amount = 1) {
  const row = await db.selectFrom('user_stats')
    .select('value')
    .where('key', '=', key)
    .executeTakeFirst();
    
  const current = row ? row.value : 0;
  const newValue = current + amount;
  
  await db.insertInto('user_stats')
    .values({
      key,
      value: newValue,
      updated_at: new Date().toISOString()
    })
    .onConflict(oc => oc.column('key').doUpdateSet({
      value: newValue,
      updated_at: new Date().toISOString()
    }))
    .execute();
    
  return newValue;
}

export async function addPlaytimeXP(amount) {
  return await incrementUserStat('playtime_xp', amount);
}

export async function unlockMark(id) {
    try {
        await db.insertInto('unlocked_marks')
          .values({
              id,
              unlocked_at: new Date().toISOString()
          })
          .onConflict(oc => oc.doNothing())
          .execute();
        return true;
    } catch (e) {
        console.error('[DB] Failed to unlock mark:', e);
        return false;
    }
}

export async function getGamificationStatus() {
  // Bubbling up newUnlocks so the IPC handler can detect them
  const { metrics, totalXP, newUnlocks } = await syncProgress();
  
  const unlockedRows = await db.selectFrom('unlocked_tiers').select('id').execute();
  const unlockedMarksRows = await db.selectFrom('unlocked_marks').select('id').execute();

  return {
    metrics,
    totalXP,
    unlockedTiers: unlockedRows.map(r => r.id),
    unlockedMarks: unlockedMarksRows.map(r => r.id),
    tree: PROGRESSION_TREE, // Send the Source of Truth to frontend
    newUnlocks // EXPOSED
  };
}

// Define the current target version for Milestones logic
const CURRENT_MIGRATION_VERSION = 111; // Represents v1.1.1 Update

export async function runGamificationMigration() {
  console.log('[Migration] Checking Milestone Schema Version...');

  // 1. Get the last applied version from system_meta
  const metaRow = await db.selectFrom('system_meta')
    .select('value')
    .where('key', '=', 'milestone_migration_version')
    .executeTakeFirst();

  const lastVersion = metaRow ? parseInt(metaRow.value, 10) : 0;

  // 2. Check if we need to migrate
  if (lastVersion >= CURRENT_MIGRATION_VERSION) {
    return { success: false, reason: 'already_up_to_date', version: lastVersion };
  }

  console.log(`[Migration] Updating Milestones from v${lastVersion} to v${CURRENT_MIGRATION_VERSION}...`);

  // 1. Clear Deprecated Data
  await db.deleteFrom('unlocked_tiers').execute();
  
  // 2. Calculate Session XP (0.2 XP per minute)
  const sessionRes = rawDb.prepare("SELECT sum(duration_seconds) as total FROM sessions").get();
  const totalSeconds = sessionRes ? sessionRes.total : 0;
  const sessionXP = Math.floor((totalSeconds / 60) * 0.2);

  // 3. Calculate Status XP (Beat=250, Completed=1000)
  const beatRes = rawDb.prepare("SELECT count(*) as count FROM library WHERE status = 'Beat'").get();
  const completedRes = rawDb.prepare("SELECT count(*) as count FROM library WHERE status = 'Completed' OR status = '100%'").get(); // normalizing 100%
  const statusXP = ((beatRes?.count || 0) * 250) + ((completedRes?.count || 0) * 1000);

  // 4. Phase 1 Sync: Unlock Badges based on Non-XP Metrics
  // We need to set a temporary total_xp to session+status so syncProgress doesn't fail if it relies on it
  await incrementUserStat('total_xp', (sessionXP + statusXP) * -1); // Reset to 0 roughly
  await incrementUserStat('total_xp', (sessionXP + statusXP));
  
  await syncProgress(); // This fills unlocked_tiers with Collector, Journalist, etc.

  // 5. Calculate Rank XP from the newly unlocked tiers
  // We need to fetch all unlocked IDs and map them to their XP values from the TREE
  const unlockedRows = rawDb.prepare("SELECT id FROM unlocked_tiers").all();
  let rankXP = 0;
  
  // Build Lookup
  const tierXpMap = {};
  PROGRESSION_TREE.forEach(arc => {
    arc.disciplines.forEach(disc => {
        disc.tiers.forEach(tier => {
            tierXpMap[`${disc.id}_${tier.level}`] = tier.xp;
        });
    });
  });

  unlockedRows.forEach(row => {
    rankXP += (tierXpMap[row.id] || 0);
  });

  // 6. Final Total XP
  const finalTotalXP = sessionXP + statusXP + rankXP;
  
  // Force Update user_stats
  await db.insertInto('user_stats')
    .values({ key: 'total_xp', value: finalTotalXP, updated_at: new Date().toISOString() })
    .onConflict(oc => oc.column('key').doUpdateSet({ value: finalTotalXP, updated_at: new Date().toISOString() }))
    .execute();

  await db.insertInto('user_stats')
    .values({ key: 'current_xp', value: finalTotalXP, updated_at: new Date().toISOString() })
    .onConflict(oc => oc.column('key').doUpdateSet({ value: finalTotalXP, updated_at: new Date().toISOString() }))
    .execute();

  // 7. Phase 2 Sync: Unlock Ascendant Badges (which rely on the now-correct total_xp)
  const finalResult = await syncProgress();

  // 8. Update Version
  await db.insertInto('system_meta')
    .values({ key: 'milestone_migration_version', value: String(CURRENT_MIGRATION_VERSION) })
    .onConflict(oc => oc.column('key').doUpdateSet({ value: String(CURRENT_MIGRATION_VERSION) }))
    .execute();

  console.log(`[Migration] Complete. Total XP: ${finalTotalXP} (Session: ${sessionXP}, Status: ${statusXP}, Rank: ${rankXP})`);

  return { 
    success: true, 
    newUnlocks: finalResult.newUnlocks,
    stats: { sessionXP, statusXP, rankXP, total: finalTotalXP }
  };
}
