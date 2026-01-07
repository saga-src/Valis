
import psList from 'ps-list';
import * as db from '../db/queries.js';

class GameWatcher {
  constructor() {
    this.activeSessions = {}; // Map<gameId, { id, gameId, title, executable, startTime }>
    this.interval = null;
    this.window = null;
  }

  start(window, intervalMs = 5000) {
    if (this.interval) return;
    this.window = window;
    //console.log('[Watcher] Service started. Polling every', intervalMs, 'ms');
    this.check(); // Immediate check
    this.interval = setInterval(() => this.check(), intervalMs);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      //console.log('[Watcher] Service stopped');
    }
  }

  async check() {
    try {
      const trackableGames = await db.getGamesWithExecutables();
      const activeGameIds = Object.keys(this.activeSessions);

      // If no games to track and no session running, we can skip ps-list for efficiency
      if (trackableGames.length === 0 && activeGameIds.length === 0) return;

      const processes = await psList();
      const processNames = new Set(processes.map(p => p.name.toLowerCase()));

      // 1. Check active sessions - End if process stopped
      for (const gameId of activeGameIds) {
          const session = this.activeSessions[gameId];
          const isRunning = processNames.has(session.executable.toLowerCase());
          
          if (!isRunning) {
              await this.endSession(gameId);
          }
      }

      // 2. Check for new starts
      for (const game of trackableGames) {
          if (this.activeSessions[game.id]) continue; // Already tracking

          if (processNames.has(game.executable.toLowerCase())) {
              await this.startSession(game);
          }
      }

    } catch (error) {
      console.error('[Watcher] Error scanning processes:', error);
    }
  }

  async startSession(game) {
    console.log(`[Watcher] Process found: ${game.title} (${game.executable})`);

    // 1. Check for existing open session first (Session Unification)
    const existing = await db.getOpenSession(game.id);
    let sessionId = null;
    let startTime = Date.now();
    
    if (existing) {
        console.log(`[Watcher] >> DECISION: Attach to Existing Session (ID: ${existing.id})`);
        sessionId = existing.id;
        startTime = existing.start_time; // Re-use existing start time
    } else {
        console.log(`[Watcher] >> DECISION: Create NEW Session`);
        // 2. Create new session if none exists
        sessionId = await db.createSession(game.id, startTime);
        console.log(`[Watcher] New Session Created (ID: ${sessionId})`);
    }

    // Store active session state with ID
    this.activeSessions[game.id] = {
      id: sessionId,
      gameId: game.id,
      title: game.title,
      executable: game.executable,
      startTime: startTime
    };

    // Broadcast to Renderer
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('watcher:session-started', { 
        gameId: game.id, 
        startTime: startTime,
        sessionId: sessionId 
      });
    }
  }

  async endSession(gameId) {
    const session = this.activeSessions[gameId];
    if (!session) return;

    const endTime = Date.now();
    const durationMs = endTime - session.startTime;
    // Ensure at least 1 minute if detected, otherwise it looks like 0 duration
    const durationMinutes = Math.max(1, Math.round(durationMs / 60000));

    console.log(`[Watcher] Process Ended for ${session.title}`);
    console.log(`[Watcher] Ending Session ID: ${session.id}`);
    
    await db.endSession(session.id, endTime);
    
    // Broadcast to Renderer
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('watcher:session-ended', { 
        gameId: session.gameId, 
        duration: durationMinutes 
      });
    }
    
    delete this.activeSessions[gameId];
  }
}

export const gameWatcher = new GameWatcher();
