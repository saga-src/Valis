
import { ipcMain } from 'electron';
import * as dbActions from '../db/queries.js';
import { rawDb, db } from '../db/client.js';
import { emitDataChange } from '../services/DataChangeBus.js';

export function registerSessionHandlers() {
  ipcMain.handle('session:start', async (event, { gameId, startTime }) => {
    const id = await dbActions.createSession(gameId, startTime);
    emitDataChange({ type: 'session', source: 'session:start', gameId, sessionId: id, important: true });
    return { success: true, sessionId: id };
  });

  ipcMain.handle('session:stop', async (event, { sessionId }) => {
    const session = await db.selectFrom('sessions').select('game_id').where('id', '=', sessionId).executeTakeFirst();
    const finalizedSession = await dbActions.endSession(sessionId);
    if (!finalizedSession) {
      return { success: false, error: 'Session not found' };
    }
    emitDataChange({ type: 'session', source: 'session:stop', gameId: session?.game_id, sessionId, important: true });
    return { success: true, session: finalizedSession };
  });

  // Also handle the legacy channel if main.js logic is being migrated fully here
  ipcMain.handle('session:end', async (event, { sessionId, data }) => {
    const session = await db.selectFrom('sessions').select('game_id').where('id', '=', sessionId).executeTakeFirst();
    const finalizedSession = await dbActions.endSession(sessionId, data);
    if (!finalizedSession) {
      return { success: false, error: 'Session not found' };
    }
    emitDataChange({ type: 'session', source: 'session:end', gameId: session?.game_id, sessionId, important: true });
    return { success: true, session: finalizedSession };
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

  ipcMain.handle('session:get-page', async (event, options = {}) => {
    return await dbActions.getSessionsPage(options);
  });
  
  ipcMain.handle('session:get-recent', async (event, days) => {
    return await dbActions.getRecentSessions(days);
  });

  // Manual Management Handlers
  ipcMain.handle('session:add-manual', async (event, data) => {
    const id = await dbActions.addManualSession(data);
    emitDataChange({ type: 'session', source: 'session:add-manual', gameId: data.gameId, sessionId: id, important: true });
    return { success: true, sessionId: id };
  });

  ipcMain.handle('session:update', async (event, { sessionId, updates }) => {
    const session = await db.selectFrom('sessions').select('game_id').where('id', '=', sessionId).executeTakeFirst();
    await dbActions.updateSession(sessionId, updates);
    emitDataChange({ type: 'session', source: 'session:update', gameId: session?.game_id, sessionId, important: true });
    return { success: true };
  });

  ipcMain.handle('session:delete', async (event, sessionId) => {
    const session = await db.selectFrom('sessions').select('game_id').where('id', '=', sessionId).executeTakeFirst();
    await dbActions.deleteSession(sessionId);
    emitDataChange({ type: 'session', source: 'session:delete', gameId: session?.game_id, sessionId, important: true });
    return { success: true };
  });
}
