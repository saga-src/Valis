
import { ipcMain } from 'electron';
import * as dbActions from '../db/queries.js';
import { rawDb, db } from '../db/client.js';
import { emitDataChange } from '../services/DataChangeBus.js';

export function registerSessionHandlers() {
  ipcMain.handle('session:start', async (event, { gameId, startTime, previousSessionId, previousData }) => {
    const result = await dbActions.startSession(gameId, startTime, { previousSessionId, previousData });
    for (const session of result.finalizedSessions) {
      emitDataChange({ type: 'session', source: 'session:switch', gameId: session.game_id, sessionId: session.id, important: true });
    }
    if (!result.reused) {
      emitDataChange({ type: 'session', source: 'session:start', gameId, sessionId: result.sessionId, important: true });
    }
    return { success: true, ...result };
  });

  ipcMain.handle('session:stop', async (event, { sessionId }) => {
    const result = await dbActions.endSession(sessionId);
    if (result.status === 'not-found') {
      return { success: false, error: 'Session not found' };
    }
    if (result.status === 'finished') {
      emitDataChange({ type: 'session', source: 'session:stop', gameId: result.session.game_id, sessionId, important: true });
    }
    return { success: true, ...result };
  });

  // Also handle the legacy channel if main.js logic is being migrated fully here
  ipcMain.handle('session:end', async (event, { sessionId, data }) => {
    const result = await dbActions.endSession(sessionId, data);
    if (result.status === 'not-found') {
      return { success: false, error: 'Session not found' };
    }
    if (result.status === 'finished') {
      emitDataChange({ type: 'session', source: 'session:end', gameId: result.session.game_id, sessionId, important: true });
    }
    return { success: true, ...result };
  });

  ipcMain.handle('session:get-active', () => dbActions.getActiveSession());

  ipcMain.handle('session:save-draft', async (event, { sessionId, data }) => {
    const session = await dbActions.saveSessionDraft(sessionId, data);
    return session ? { success: true, session } : { success: false, error: 'Session not found' };
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
