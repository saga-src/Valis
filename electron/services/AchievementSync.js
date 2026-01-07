
import { db } from '../db/client.js';

/**
 * Links fetched achievements to sessions and updates the database.
 * @param {string} gameId - The internal Game ID
 * @param {Array<{id: string, unlocked: boolean, unlockTime: number}>} fetchedAchievements 
 */
export async function syncGameAchievements(gameId, fetchedAchievements) {
  let addedCount = 0;

  for (const ach of fetchedAchievements) {
    if (!ach.unlocked) continue;

    // 1. Check if already recorded
    const existing = await db.selectFrom('achievement_progress')
      .select('achievement_id')
      .where('game_id', '=', String(gameId))
      .where('achievement_id', '=', ach.id)
      .executeTakeFirst();

    if (existing) continue;

    // 2. Prepare timestamp
    // unlockTime is expected to be Unix Timestamp in milliseconds
    const unlockedAt = new Date(ach.unlockTime).toISOString();
    const unlockTs = ach.unlockTime;

    // 3. Find Session Linker
    // Find a session where start <= unlock <= end
    const session = await db.selectFrom('sessions')
      .select('id')
      .where('game_id', '=', String(gameId))
      .where('start_time', '<=', unlockTs)
      .where((eb) => eb.or([
        eb('end_time', '>=', unlockTs),
        eb('end_time', '=', 0) // Handle active sessions
      ]))
      .orderBy('start_time', 'desc')
      .executeTakeFirst();

    // 4. Insert Progress
    await db.insertInto('achievement_progress')
      .values({
        game_id: String(gameId),
        achievement_id: ach.id,
        unlocked_at: unlockedAt,
        session_id: session ? session.id : null
      })
      .execute();

    // 5. Update Definition Status
    await db.updateTable('achievements')
      .set({ unlocked: 1 })
      .where('id', '=', ach.id)
      .where('game_id', '=', String(gameId))
      .execute();

    addedCount++;
  }

  return addedCount;
}
