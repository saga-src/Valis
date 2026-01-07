
import { rawDb, db } from '../client.js';
import { PROGRESSION_TREE } from '../../lib/internal_milestones.js';

// --- Metrics Calculation ---

export async function getMetrics() {
  const metrics = {};

  // 1. Total Games
  const gamesRes = rawDb.prepare('SELECT count(*) as count FROM library').get();
  metrics.total_games = gamesRes ? gamesRes.count : 0;

  // 2. Tagged Sessions (Notes not empty)
  const taggedRes = rawDb.prepare("SELECT count(*) as count FROM sessions WHERE notes IS NOT NULL AND notes != '[]' AND notes != ''").get();
  metrics.tagged_sessions = taggedRes ? taggedRes.count : 0;

  // 3. Distinct Sources (Count unique store_ids in library_platforms)
  // We use store_id from library_platforms as a proxy for source diversity
  const sourcesRes = rawDb.prepare('SELECT count(distinct store_id) as count FROM library_platforms WHERE store_id IS NOT NULL').get();
  metrics.distinct_sources = sourcesRes ? sourcesRes.count : 0;

  // 4. Total Reviews (Final Score Set)
  const reviewsRes = rawDb.prepare("SELECT count(*) as count FROM library WHERE final_score IS NOT NULL").get();
  metrics.total_reviews = reviewsRes ? reviewsRes.count : 0;

  // 5. Critical Reviews (Parse Metadata)
  // SQLite JSON support varies, so we fetch all review_metadata and parse in JS for safety
  const metaRows = rawDb.prepare("SELECT review_metadata FROM library WHERE review_metadata IS NOT NULL").all();
  let criticalCount = 0;
  for (const row of metaRows) {
    try {
      const meta = JSON.parse(row.review_metadata);
      if (meta && meta.method === 'CRITICAL') {
        criticalCount++;
      }
    } catch (e) {
      // ignore parse errors
    }
  }
  metrics.critical_reviews = criticalCount;

  // 6. Shared Cards (From User Stats)
  const sharedRes = rawDb.prepare("SELECT value FROM user_stats WHERE key = 'metric_shared_cards'").get();
  metrics.shared_cards = sharedRes ? sharedRes.value : 0;

  // 7. Games Beat
  const beatRes = rawDb.prepare("SELECT count(*) as count FROM library WHERE status = 'Beat'").get();
  metrics.games_beat = beatRes ? beatRes.count : 0;

  // 8. Games Completed
  const completedRes = rawDb.prepare("SELECT count(*) as count FROM library WHERE status = 'Completed'").get();
  metrics.games_completed = completedRes ? completedRes.count : 0;

  // 9. Total Achievements
  const achRes = rawDb.prepare("SELECT count(*) as count FROM achievements WHERE unlocked = 1").get();
  metrics.total_achievements = achRes ? achRes.count : 0;

  // 10. Longest Session (Hours)
  const sessionMaxRes = rawDb.prepare("SELECT max(duration_seconds) as max FROM sessions").get();
  metrics.longest_session = sessionMaxRes && sessionMaxRes.max ? sessionMaxRes.max / 3600 : 0;

  // 11. Max Hours on One Game
  // Sum legacy + tracked for each game, find max
  // SQLite aggregation: MAX(playtime_seconds + legacy_playtime_seconds)
  const maxPlaytimeRes = rawDb.prepare("SELECT max(playtime_seconds + legacy_playtime_seconds) as max FROM library").get();
  metrics.max_hours_one_game = maxPlaytimeRes && maxPlaytimeRes.max ? maxPlaytimeRes.max / 3600 : 0;

  // 12. Current Streak
  // Get all session dates
  const sessionDatesRes = rawDb.prepare("SELECT start_time FROM sessions ORDER BY start_time DESC").all();
  
  if (sessionDatesRes.length === 0) {
    metrics.current_streak = 0;
  } else {
    const dates = sessionDatesRes.map(row => new Date(row.start_time).toISOString().split('T')[0]);
    // Deduplicate
    const uniqueDates = [...new Set(dates)];
    
    // Check if today or yesterday is present
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    let streak = 0;
    
    // If most recent is neither today nor yesterday, streak is broken (0)
    if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) {
      metrics.current_streak = 0;
    } else {
      // Calculate consecutive days backwards from uniqueDates[0]
      // We iterate the sorted unique dates
      let currentDate = new Date(uniqueDates[0]);
      streak = 1;
      
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
