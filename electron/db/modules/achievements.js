
import { db } from '../client.js';
import { sql } from 'kysely';
import { fetchSteamAchievements } from '../../services/integrations/SteamScraper.js';
import { emitDataChange } from '../../services/DataChangeBus.js';

export async function refreshSteamAchievements(gameId, steamId) {
  console.log(`[DB] Found Steam ID ${steamId} for Game ${gameId}. Fetching achievements...`);
  try {
      const steamData = await fetchSteamAchievements(steamId);
      
      if (steamData && steamData.length > 0) {
          console.log(`[DB] Scraper found ${steamData.length} items. Saving to DB...`);
          
          await db.transaction().execute(async (trx) => {
              for (const ach of steamData) {
                  await trx.insertInto('achievements')
                      .values({
                          id: ach.id,
                          game_id: String(gameId),
                          name: ach.name,
                          description: ach.description,
                          icon_url: ach.icon,
                          is_hidden: ach.is_hidden ? 1 : 0,
                          unlocked: 0 
                      })
                      .onConflict((oc) => oc
                          .columns(['game_id', 'id'])
                          .doUpdateSet({
                              name: (eb) => eb.ref('excluded.name'),
                              description: (eb) => eb.ref('excluded.description'),
                              icon_url: (eb) => eb.ref('excluded.icon_url')
                          })
                      )
                      .execute();
              }
          });
          console.log(`[DB] ✅ Successfully saved ${steamData.length} achievements.`);
      } else {
          console.warn(`[DB] Scraper returned 0 achievements for ${steamId}.`);
      }
  } catch (err) {
      console.error(`[DB] Failed to save achievements:`, err);
  }
}

/**
 * Universal Achievement Saver
 * Saves/Updates achievement definitions and progress from ANY source.
 * @param {string} gameId Internal Game UUID
 * @param {Array} achievements List of { id, name, description, icon, is_hidden, unlocked, unlocked_at }
 * @param {{ mode?: 'full' | 'lockedOnly' | 'definitionsOnly' }} options
 */
export async function saveAchievementsToDb(gameId, achievements, options = {}) {
    const gId = String(gameId);
    const mode = options.mode || 'full';
    let remoteUnlockedCount = 0;
    let newlyUnlocked = 0;
    let definitionsUpdated = 0;
    let repairedUnlockFlags = 0;
    let lockedOrphanUnlocks = 0;

    await db.transaction().execute(async (trx) => {
        for (const ach of achievements) {
            const achievementId = String(ach.id);
            const existingProgress = await trx.selectFrom('achievement_progress')
                .select(['unlocked_at'])
                .where('game_id', '=', gId)
                .where('achievement_id', '=', achievementId)
                .executeTakeFirst();

            const hasProgressUnlock = Boolean(existingProgress?.unlocked_at);
            const remoteUnlocked = Boolean(ach.unlocked);
            const remoteUnlockedWithProgress = remoteUnlocked && Boolean(ach.unlocked_at);
            const shouldUnlockDefinition = mode === 'definitionsOnly'
                ? hasProgressUnlock
                : hasProgressUnlock || remoteUnlockedWithProgress;

            if (remoteUnlocked) remoteUnlockedCount++;
            if (remoteUnlockedWithProgress && !hasProgressUnlock) newlyUnlocked++;

            await trx.insertInto('achievements')
                .values({
                    id: achievementId,
                    game_id: gId,
                    name: ach.name || achievementId,
                    description: ach.description || '',
                    icon_url: ach.icon || '',
                    is_hidden: ach.is_hidden ? 1 : 0,
                    unlocked: shouldUnlockDefinition ? 1 : 0
                })
                .onConflict((oc) => oc
                    .columns(['game_id', 'id'])
                    .doUpdateSet({
                        name: (eb) => eb.ref('excluded.name'),
                        description: (eb) => eb.ref('excluded.description'),
                        icon_url: (eb) => eb.ref('excluded.icon_url'),
                        is_hidden: (eb) => eb.ref('excluded.is_hidden'),
                        unlocked: (eb) => eb.ref('excluded.unlocked')
                    })
                )
                .execute();
            definitionsUpdated++;

            if (mode !== 'definitionsOnly' && remoteUnlockedWithProgress) {
                if (!existingProgress) {
                    await trx.insertInto('achievement_progress')
                        .values({
                            game_id: gId,
                            achievement_id: achievementId,
                            unlocked_at: ach.unlocked_at,
                            session_id: null
                        })
                        .execute();
                } else if (!existingProgress.unlocked_at) {
                    await trx.updateTable('achievement_progress')
                        .set({ unlocked_at: ach.unlocked_at })
                        .where('game_id', '=', gId)
                        .where('achievement_id', '=', achievementId)
                        .execute();
                }
            }
        }
    });

    if (mode !== 'definitionsOnly') {
        const repairStats = await repairAchievementUnlockFlags(gId);
        repairedUnlockFlags += repairStats.unlockedFromProgress;
        lockedOrphanUnlocks += repairStats.lockedWithoutProgress;
    }

    // 3. Automation: Check for 100% completion
    const promotedToCompleted = await checkGameCompletion(gId);

    return {
        total: achievements.length,
        unlocked: remoteUnlockedCount,
        newlyUnlocked,
        definitionsUpdated,
        repairedUnlockFlags,
        lockedOrphanUnlocks,
        promotedToCompleted,
        mode
    };
}

export async function getAchievements(gameId) {
  await repairAchievementUnlockFlags(gameId);

  const rows = await db.selectFrom('achievements')
    .leftJoin('achievement_progress', (join) => 
      join
        .onRef('achievements.id', '=', 'achievement_progress.achievement_id')
        .on('achievement_progress.game_id', '=', String(gameId))
    )
    .select([
      'achievements.id',
      'achievements.name',
      'achievements.description',
      'achievements.icon_url as iconUrl',
      'achievements.is_hidden as isHidden',
      'achievements.game_id',
      'achievements.unlocked as defaultUnlocked',
      'achievement_progress.unlocked_at as unlockedAt'
    ])
    .where('achievements.game_id', '=', String(gameId))
    .execute();
    
  return rows.map(row => ({
      ...row,
      isHidden: Boolean(row.isHidden),
      unlockedAt: row.unlockedAt
  }));
}

export const getGameAchievements = getAchievements;

export async function getAchievementById(gameId, achievementId) {
  return await db.selectFrom('achievements')
    .select(['name', 'description', 'icon_url'])
    .where('game_id', '=', String(gameId))
    .where('id', '=', String(achievementId))
    .executeTakeFirst();
}

/**
 * Checks if a game has 100% achievements and updates status if so.
 * Returns true if the game was promoted to 'Completed'.
 */
export async function checkGameCompletion(gameId) {
    try {
        const stats = await db.selectFrom('achievements')
            .select(({ fn }) => [
                fn.count('id').as('total'),
                fn.sum(
                    // SQLite boolean sum
                    sql`CASE WHEN unlocked = 1 THEN 1 ELSE 0 END`
                ).as('unlocked')
            ])
            .where('game_id', '=', String(gameId))
            .executeTakeFirst();

        if (stats && stats.total > 0 && stats.total === stats.unlocked) {
            // Check current status first to avoid overwriting if already Completed
            const current = await db.selectFrom('library')
                .select('status')
                .where('game_id', '=', String(gameId))
                .executeTakeFirst();

            if (current && current.status !== 'Completed') {
                console.log(`[DB] 🏆 100% Completion Detected for Game ${gameId}. Promoting to 'Completed'.`);
                
                await db.updateTable('library')
                    .set({ status: 'Completed', updated_at: Date.now() })
                    .where('game_id', '=', String(gameId))
                    .execute();

                emitDataChange({
                    type: 'game',
                    source: 'achievement-completion',
                    gameId,
                    important: true
                });
                
                return true;
            }
        }
    } catch (e) {
        console.error('[DB] Completion check failed:', e);
    }
    return false;
}

export async function saveAchievementProgress(gameId, achievementId, { unlocked_at, session_id }) {
  if (!unlocked_at) {
    await repairAchievementUnlockFlags(gameId);
    return false;
  }

  await db.insertInto('achievement_progress')
    .values({
      game_id: String(gameId),
      achievement_id: String(achievementId),
      unlocked_at,
      session_id
    })
    .onConflict(oc => oc
      .columns(['game_id', 'achievement_id'])
      .doUpdateSet({ unlocked_at, session_id })
    )
    .execute();

  await db.updateTable('achievements')
    .set({ unlocked: 1 })
    .where('game_id', '=', String(gameId))
    .where('id', '=', String(achievementId))
    .execute();

  return true;
}

export async function repairAchievementUnlockFlags(gameId) {
    const gId = String(gameId);
    const shouldBeUnlocked = await db.selectFrom('achievements')
        .innerJoin('achievement_progress', (join) =>
            join
                .onRef('achievements.id', '=', 'achievement_progress.achievement_id')
                .on('achievement_progress.game_id', '=', gId)
        )
        .select('achievements.id')
        .where('achievements.game_id', '=', gId)
        .where('achievements.unlocked', '!=', 1)
        .where('achievement_progress.unlocked_at', 'is not', null)
        .execute();

    const shouldBeLocked = await db.selectFrom('achievements')
        .leftJoin('achievement_progress', (join) =>
            join
                .onRef('achievements.id', '=', 'achievement_progress.achievement_id')
                .on('achievement_progress.game_id', '=', gId)
        )
        .select('achievements.id')
        .where('achievements.game_id', '=', gId)
        .where('achievements.unlocked', '=', 1)
        .where((eb) => eb.or([
            eb('achievement_progress.achievement_id', 'is', null),
            eb('achievement_progress.unlocked_at', 'is', null)
        ]))
        .execute();

    if (shouldBeUnlocked.length === 0 && shouldBeLocked.length === 0) {
        return { unlockedFromProgress: 0, lockedWithoutProgress: 0 };
    }

    await db.transaction().execute(async (trx) => {
        for (const row of shouldBeUnlocked) {
            await trx.updateTable('achievements')
                .set({ unlocked: 1 })
                .where('game_id', '=', gId)
                .where('id', '=', String(row.id))
                .execute();
        }

        for (const row of shouldBeLocked) {
            await trx.updateTable('achievements')
                .set({ unlocked: 0 })
                .where('game_id', '=', gId)
                .where('id', '=', String(row.id))
                .execute();
        }
    });

    return {
        unlockedFromProgress: shouldBeUnlocked.length,
        lockedWithoutProgress: shouldBeLocked.length
    };
}

/**
 * Updates achievement status by Name (used for Epic/Cross-Platform syncing).
 * Since Epic only provides display names, we try to match them to our local DB.
 */
export async function updateAchievementStatusByName(gameId, achievementName, unlockedAt) {
    try {
        // 1. Find the achievement ID by Name
        const ach = await db.selectFrom('achievements')
            .select('id')
            .where('game_id', '=', String(gameId))
            .where('name', '=', achievementName)
            .executeTakeFirst();

        if (ach) {
            // 2. Save detailed progress only when the source provides a real timestamp.
            if (!unlockedAt) {
                await repairAchievementUnlockFlags(gameId);
                return false;
            }

            await saveAchievementProgress(gameId, ach.id, {
                unlocked_at: unlockedAt,
                session_id: null
            });
            
            // 3. Auto-Complete Check
            await checkGameCompletion(gameId);
            
            return true;
        } else {
            // console.warn(`[DB] Could not find achievement "${achievementName}" for game ${gameId}`);
            return false;
        }
    } catch (error) {
        console.error('[DB] Failed to update achievement by name:', error);
        return false;
    }
}

export const unlockAchievement = updateAchievementStatusByName;

/**
 * Upserts full Achievement definitions and status from PSN data.
 * Can handle both definitions+status (legacy 3 args) or just definitions (2 args).
 */
export async function savePsnAchievements(gameId, definitions, earnedStatus) {
    try {
        await db.transaction().execute(async (trx) => {
            // 1. Upsert Definitions
            // Keep track of valid IDs we are inserting
            const validIds = new Set();

            for (const def of definitions) {
                // Ensure ID 0 is string "0"
                const id = (def.id !== undefined && def.id !== null) ? String(def.id) : String(def.name);

                const icon = def.iconUrl || def.icon;
                const hidden = (def.isHidden !== undefined) ? (def.isHidden ? 1 : 0) : (def.hidden ? 1 : 0);
                
                validIds.add(id);

                await trx.insertInto('achievements')
                    .values({
                        id: id, 
                        game_id: String(gameId),
                        name: def.name,
                        description: def.description,
                        icon_url: icon,
                        is_hidden: hidden,
                        unlocked: 0
                    })
                    .onConflict((oc) => oc
                        .columns(['game_id', 'id'])
                        .doUpdateSet({
                            name: (eb) => eb.ref('excluded.name'),
                            description: (eb) => eb.ref('excluded.description'),
                            icon_url: (eb) => eb.ref('excluded.icon_url')
                        })
                    )
                    .execute();
            }

            // 2. Update Status
            if (earnedStatus && Array.isArray(earnedStatus)) {
                for (const earned of earnedStatus) {
                    const strId = String(earned.id);
                    
                    // CRITICAL SAFETY CHECK:
                    // Only save progress if we actually have the definition for this ID.
                    if (!validIds.has(strId)) {
                        // console.warn(`[DB] Skipping unknown achievement ID ${strId} for game ${gameId}`);
                        continue;
                    }

                    if (earned.earned && earned.earnedDateTime) {
                        await trx.updateTable('achievements')
                            .set({ unlocked: 1 })
                            .where('game_id', '=', String(gameId))
                            .where('id', '=', strId)
                            .execute();

                        // Upsert Progress only when PSN gives us a real earned timestamp.
                        await trx.insertInto('achievement_progress')
                            .values({
                                game_id: String(gameId),
                                achievement_id: strId,
                                unlocked_at: earned.earnedDateTime,
                                session_id: null
                            })
                            .onConflict(oc => oc
                                .columns(['game_id', 'achievement_id'])
                                .doUpdateSet({ unlocked_at: earned.earnedDateTime })
                            )
                            .execute();
                    }
                }
            }
        });
        
        await repairAchievementUnlockFlags(gameId);

        // Check for 100% completion after bulk update
        await checkGameCompletion(gameId);
        
        return true;
    } catch (error) {
        console.error('[DB] Failed to save PSN achievements:', error);
        return false;
    }
}
