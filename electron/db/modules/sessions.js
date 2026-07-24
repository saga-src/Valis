import { db } from '../client.js';
import crypto from 'crypto';
import { saveGameTags } from './tags.js';
import { recalculatePlaytime } from './games.js';
import { incrementUserStat } from './gamification.js';

export async function createSession(gameId, startTime) {
  const id = crypto.randomUUID();
  await db.insertInto('sessions')
    .values({
      id,
      game_id: String(gameId),
      start_time: startTime,
      end_time: 0,
      duration_seconds: 0,
      mood: '🙂',
      notes: '[]',
      journal_text: ''
    })
    .execute();
  return id;
}

export async function endSession(sessionId, dataOrEndTime = Date.now()) {
  const session = await db.selectFrom('sessions')
    .select(['start_time', 'game_id'])
    .where('id', '=', sessionId)
    .executeTakeFirst();

  if (session) {
    let endTime = Date.now();
    let updateFields = {};

    if (typeof dataOrEndTime === 'number') {
      endTime = dataOrEndTime;
    } else if (dataOrEndTime && typeof dataOrEndTime === 'object') {
      const { mood, notes, journal, platform_id, end_time } = dataOrEndTime;
      endTime = end_time || Date.now();
      updateFields = { mood, notes, journal_text: journal, platform_id };
      if (notes) await saveGameTags(session.game_id, notes);
    }

    const duration = Math.max(0, Math.round((endTime - session.start_time) / 1000));
    
    await db.updateTable('sessions')
      .set({ ...updateFields, end_time: endTime, duration_seconds: duration })
      .where('id', '=', sessionId)
      .execute();
      
    await recalculatePlaytime(session.game_id);

    // ⚡ VETERAN TRIGGER: Increment post-game sessions if game is Beat or Completed
    const game = await db.selectFrom('library').select('status').where('game_id', '=', session.game_id).executeTakeFirst();
    if (game && (game.status === 'Beat' || game.status === 'Completed')) {
        await incrementUserStat('veteran_sessions', 1);
    }

    return await db.selectFrom('sessions')
      .selectAll()
      .where('id', '=', sessionId)
      .executeTakeFirst();
  }

  return null;
}

export async function addManualSession(sessionData) {
    const { gameId, startTime, durationSeconds, notes, mood, journal, platformId, platform } = sessionData;
    const id = crypto.randomUUID();
    const endTime = startTime + (durationSeconds * 1000);
    
    // Handle platform (legacy 'platform' or 'platformId')
    const pid = platformId !== undefined ? platformId : platform;

    await db.insertInto('sessions')
        .values({
            id,
            game_id: String(gameId),
            start_time: startTime,
            end_time: endTime,
            duration_seconds: durationSeconds,
            mood: mood || '🙂',
            notes: notes ? (typeof notes === 'string' ? notes : JSON.stringify(notes)) : '[]',
            journal_text: journal || '',
            platform_id: pid || null
        })
        .execute();
    
    if (notes) await saveGameTags(String(gameId), notes);
    await recalculatePlaytime(String(gameId));

    // ⚡ VETERAN TRIGGER: Increment post-game sessions if game is Beat or Completed
    const game = await db.selectFrom('library').select('status').where('game_id', '=', String(gameId)).executeTakeFirst();
    if (game && (game.status === 'Beat' || game.status === 'Completed')) {
        await incrementUserStat('veteran_sessions', 1);
    }

    return id;
}

export async function updateSession(sessionId, updates) {
    const session = await db.selectFrom('sessions')
        .select(['game_id', 'start_time', 'end_time'])
        .where('id', '=', sessionId)
        .executeTakeFirst();

    if (!session) throw new Error("Session not found");

    const newStart = updates.startTime !== undefined ? updates.startTime : session.start_time;
    
    let newEnd = session.end_time;
    let newDuration = updates.durationSeconds; 

    if (updates.durationSeconds !== undefined) {
        newEnd = newStart + (updates.durationSeconds * 1000);
    } else if (updates.endTime !== undefined) {
        newEnd = updates.endTime;
        newDuration = Math.round((newEnd - newStart) / 1000);
    } else if (updates.startTime !== undefined) {
        // Recalculate end based on original duration if only start changed
        const oldDuration = Math.round((session.end_time - session.start_time) / 1000);
        newDuration = oldDuration;
        newEnd = newStart + (oldDuration * 1000);
    } else {
        // Fallback if neither changed (e.g. only mood updated)
        newDuration = Math.round((newEnd - newStart) / 1000);
    }

    const updatePayload = {
        start_time: newStart,
        end_time: newEnd,
        duration_seconds: newDuration
    };

    if (updates.mood) updatePayload.mood = updates.mood;
    if (updates.notes) {
        updatePayload.notes = typeof updates.notes === 'string' ? updates.notes : JSON.stringify(updates.notes);
    }
    if (updates.journal) updatePayload.journal_text = updates.journal;
    
    // Handle platform update
    const pid = updates.platformId !== undefined ? updates.platformId : updates.platform;
    if (pid !== undefined) updatePayload.platform_id = pid;

    await db.updateTable('sessions')
        .set(updatePayload)
        .where('id', '=', sessionId)
        .execute();

    if (updates.notes) await saveGameTags(session.game_id, updates.notes);
    await recalculatePlaytime(session.game_id);
    return true;
}

export async function deleteSession(sessionId) {
    const session = await db.selectFrom('sessions')
        .select('game_id')
        .where('id', '=', sessionId)
        .executeTakeFirst();

    if (!session) return false;

    await db.deleteFrom('sessions')
        .where('id', '=', sessionId)
        .execute();

    await recalculatePlaytime(session.game_id);
    return true;
}

export async function getOpenSession(gameId) {
    return await db.selectFrom('sessions')
        .selectAll()
        .where('game_id', '=', String(gameId))
        .where('end_time', '=', 0)
        .orderBy('start_time', 'desc')
        .executeTakeFirst();
}

export async function getGameSessions(gameId) {
  return await db.selectFrom('sessions')
    .selectAll()
    .where('game_id', '=', String(gameId))
    .orderBy('start_time', 'desc')
    .execute();
}

export async function getAllSessions() {
  return await db.selectFrom('sessions').selectAll().execute();
}

export async function getSessionsPage(options = {}) {
  const rawLimit = Number(options.limit);
  const rawOffset = Number(options.offset);
  const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? rawLimit : 50, 200));
  const offset = Math.max(0, Number.isFinite(rawOffset) ? rawOffset : 0);
  const date = typeof options.date === 'string' ? options.date : '';

  let sessionsQuery = db.selectFrom('sessions').selectAll();
  let countQuery = db.selectFrom('sessions').select(({ fn }) => [
    fn.countAll().as('total')
  ]);

  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const start = new Date(`${date}T00:00:00`).getTime();
    const end = start + (24 * 60 * 60 * 1000);

    sessionsQuery = sessionsQuery
      .where('start_time', '>=', start)
      .where('start_time', '<', end);

    countQuery = countQuery
      .where('start_time', '>=', start)
      .where('start_time', '<', end);
  }

  const [sessions, countRow] = await Promise.all([
    sessionsQuery
      .orderBy('start_time', 'desc')
      .limit(limit)
      .offset(offset)
      .execute(),
    countQuery.executeTakeFirst()
  ]);

  const total = Number(countRow?.total || 0);

  return {
    sessions,
    total,
    limit,
    offset,
    hasMore: offset + sessions.length < total
  };
}

export async function getRecentSessions(days = 30) {
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  return await db.selectFrom('sessions')
    .select(['game_id', 'duration_seconds', 'start_time', 'end_time', 'platform_id'])
    .where('start_time', '>', cutoff)
    .orderBy('start_time', 'desc')
    .execute();
}

export async function importSession(session) {
    await db.insertInto('sessions').values(session).execute();
    if (session.notes) await saveGameTags(session.game_id, session.notes);
    await recalculatePlaytime(session.game_id);
}
