import crypto from 'crypto';

// This module deliberately depends only on a SQLite handle, so the same
// transaction is used by IPC and the process watcher and can run in isolation.
export function createSessionCoordinator(rawDb) {
  const openPredicate = '(end_time IS NULL OR end_time = 0)';

  function addTags(gameId, notes, previousNotes = '[]') {
    let next;
    let previous;
    try {
      next = Array.isArray(notes) ? notes : JSON.parse(notes || '[]');
      previous = Array.isArray(previousNotes) ? previousNotes : JSON.parse(previousNotes || '[]');
    } catch {
      return;
    }
    if (!Array.isArray(next)) return;
    const existing = new Set(Array.isArray(previous) ? previous : []);
    const statement = rawDb.prepare(`INSERT INTO game_tags (game_id, tag_name, usage_count)
      VALUES (?, ?, 1) ON CONFLICT(game_id, tag_name)
      DO UPDATE SET usage_count = usage_count + 1`);
    for (const tag of new Set(next)) {
      if (typeof tag === 'string' && tag.trim() && !existing.has(tag)) statement.run(gameId, tag);
    }
  }

  function finishOpen(row, dataOrEndTime, fallbackEndTime) {
    const details = dataOrEndTime && typeof dataOrEndTime === 'object' ? dataOrEndTime : {};
    const requestedEnd = typeof dataOrEndTime === 'number' ? dataOrEndTime : details.end_time;
    const endTime = Math.max(row.start_time, Number.isFinite(requestedEnd) ? requestedEnd : fallbackEndTime);
    const fields = ['end_time = ?', 'duration_seconds = ?'];
    const values = [endTime, Math.max(0, Math.round((endTime - row.start_time) / 1000))];
    for (const [input, column] of [['mood', 'mood'], ['notes', 'notes'], ['journal', 'journal_text'], ['platform_id', 'platform_id']]) {
      if (Object.hasOwn(details, input) && details[input] !== undefined) {
        fields.push(`${column} = ?`);
        values.push(details[input]);
      }
    }
    const changed = rawDb.prepare(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ? AND ${openPredicate}`)
      .run(...values, row.id).changes;
    if (!changed) return null;
    if (details.notes !== undefined) addTags(row.game_id, details.notes, row.notes);
    const updatedAt = Date.now();
    rawDb.prepare(`UPDATE library SET playtime_seconds =
      COALESCE((SELECT SUM(duration_seconds) FROM sessions WHERE game_id = ?), 0), updated_at = ?
      WHERE game_id = ?`).run(row.game_id, updatedAt, row.game_id);
    const game = rawDb.prepare('SELECT status FROM library WHERE game_id = ?').get(row.game_id);
    if (game?.status === 'Beat' || game?.status === 'Completed') {
      rawDb.prepare(`INSERT INTO user_stats (key, value, updated_at) VALUES ('veteran_sessions', 1, ?)
        ON CONFLICT(key) DO UPDATE SET value = value + 1, updated_at = excluded.updated_at`)
        .run(new Date(updatedAt).toISOString());
    }
    return rawDb.prepare('SELECT * FROM sessions WHERE id = ?').get(row.id);
  }

  function startSession(gameId, startTime = Date.now(), options = {}) {
    const target = String(gameId);
    if (!target || target === 'undefined') throw new Error('A game is required');
    const requestedStart = Number(startTime);
    if (!Number.isFinite(requestedStart) || requestedStart <= 0) throw new Error('Invalid session start time');
    return rawDb.transaction(() => {
      const open = rawDb.prepare(`SELECT * FROM sessions WHERE ${openPredicate} ORDER BY start_time DESC, id DESC`).all();
      const existing = open.find((row) => row.game_id === target);
      const finalizedSessions = [];
      const transitionTime = Date.now();
      for (const row of open) {
        if (row.id === existing?.id) continue;
        const previousData = row.id === options.previousSessionId ? options.previousData : undefined;
        const finalized = finishOpen(row, previousData, transitionTime);
        if (finalized) finalizedSessions.push(finalized);
      }
      if (existing) {
        return { sessionId: existing.id, startTime: existing.start_time, reused: true, finalizedSessions };
      }
      const sessionId = crypto.randomUUID();
      rawDb.prepare(`INSERT INTO sessions
        (id, game_id, start_time, end_time, duration_seconds, mood, notes, journal_text)
        VALUES (?, ?, ?, 0, 0, '🙂', '[]', '')`).run(sessionId, target, requestedStart);
      return { sessionId, startTime: requestedStart, reused: false, finalizedSessions };
    })();
  }

  function endSession(sessionId, dataOrEndTime = Date.now()) {
    return rawDb.transaction(() => {
      const row = rawDb.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
      if (!row) return { status: 'not-found', session: null };
      if (row.end_time !== null && row.end_time !== 0) return { status: 'already-finished', session: row };
      const session = finishOpen(row, dataOrEndTime, Date.now());
      return session ? { status: 'finished', session } : { status: 'already-finished', session: rawDb.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) };
    })();
  }

  function getActiveSession() {
    return rawDb.transaction(() => {
      const open = rawDb.prepare(`SELECT * FROM sessions WHERE ${openPredicate} ORDER BY start_time DESC, id DESC`).all();
      for (const legacy of open.slice(1)) finishOpen(legacy, undefined, Date.now());
      return open[0] || null;
    })();
  }

  function saveSessionDraft(sessionId, details) {
    if (!details || typeof details !== 'object') throw new Error('Invalid session draft');
    return rawDb.transaction(() => {
      const row = rawDb.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
      if (!row) return null;
      const fields = [];
      const values = [];
      for (const [input, column] of [['mood', 'mood'], ['notes', 'notes'], ['journal', 'journal_text'], ['platform_id', 'platform_id']]) {
        if (Object.hasOwn(details, input) && details[input] !== undefined) {
          fields.push(`${column} = ?`);
          values.push(details[input]);
        }
      }
      if (fields.length) rawDb.prepare(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`).run(...values, sessionId);
      if (details.notes !== undefined) addTags(row.game_id, details.notes, row.notes);
      return rawDb.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
    })();
  }

  return { startSession, endSession, getActiveSession, saveSessionDraft };
}
