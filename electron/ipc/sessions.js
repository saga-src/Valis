
import { ipcMain } from 'electron';
import * as dbActions from '../db/queries.js';
import { rawDb, db } from '../db/client.js';

export function registerSessionHandlers() {
  ipcMain.handle('session:start', async (event, { gameId, startTime }) => {
    const id = await dbActions.createSession(gameId, startTime);
    return { success: true, sessionId: id };
  });

  ipcMain.handle('session:stop', async (event, { sessionId }) => {
    await dbActions.endSession(sessionId);
    return { success: true };
  });

  // Also handle the legacy channel if main.js logic is being migrated fully here
  ipcMain.handle('session:end', async (event, { sessionId, data }) => {
    await dbActions.endSession(sessionId, data);
    return { success: true };
  });

  ipcMain.handle('db:get-sessions', async (event, gameId) => {
    return await dbActions.getGameSessions(gameId);
  });

  ipcMain.handle('session:get-by-game', async (event, gameId) => {
    try {
      // 1. Fetch Sessions
      const sessions = await db.selectFrom('sessions')
        .selectAll()
        .where('game_id', '=', String(gameId))
        .orderBy('start_time', 'desc')
        .execute();

      // 2. Fetch Linked Achievements (only those with session_id)
      const achievements = await db.selectFrom('achievement_progress')
        .innerJoin('achievements', (join) => 
            join.onRef('achievements.id', '=', 'achievement_progress.achievement_id')
                .onRef('achievements.game_id', '=', 'achievement_progress.game_id')
        )
        .select([
            'achievement_progress.session_id',
            'achievements.id',
            'achievements.name',
            'achievements.icon_url',
            'achievements.description',
            'achievement_progress.unlocked_at'
        ])
        .where('achievement_progress.game_id', '=', String(gameId))
        .where('achievement_progress.session_id', 'is not', null)
        .execute();

      // 3. Merge Data
      return sessions.map(session => ({
        ...session,
        achievements: achievements.filter(a => a.session_id === session.id)
      }));

    } catch (error) {
      console.error("Failed to fetch sessions for game:", gameId, error);
      throw error;
    }
  });

  ipcMain.handle('db:get-all-sessions', async () => {
    return await dbActions.getAllSessions();
  });
  
  ipcMain.handle('session:get-recent', async (event, days) => {
    return await dbActions.getRecentSessions(days);
  });

  // Manual Management Handlers
  ipcMain.handle('session:add-manual', async (event, data) => {
    const id = await dbActions.addManualSession(data);
    return { success: true, sessionId: id };
  });

  ipcMain.handle('session:update', async (event, { sessionId, updates }) => {
    await dbActions.updateSession(sessionId, updates);
    return { success: true };
  });

  ipcMain.handle('session:delete', async (event, sessionId) => {
    await dbActions.deleteSession(sessionId);
    return { success: true };
  });
}
