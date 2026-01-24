import { app } from 'electron';
import path from 'path';
import { spawn } from 'child_process';
import * as db from '../db/queries.js';

// 🟢 1. LOCATE THE BINARY
const getBinaryPath = () => {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'bin', 'fastlist.exe');
  } else {
    return path.join(app.getAppPath(), 'resources', 'bin', 'fastlist.exe');
  }
};

const fastlistPath = getBinaryPath();

// 🟢 2. RUN THE BINARY (Robust Text Parsing)
const getProcessList = () => {
  return new Promise((resolve) => {
    // windowsHide: true hides the command window
    const child = spawn(fastlistPath, [], { windowsHide: true });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
        stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
        stderr += data.toString();
    });

    child.on('close', (code) => {
        // Log any internal errors from the binary (like "System cannot find path")
        if (stderr.trim().length > 0) {
             console.error('[Watcher] Binary Stderr:', stderr);
        }

        // If output is empty
        if (!stdout || stdout.trim().length === 0) {
            // console.warn('[Watcher] Warning: Empty output from fastlist.');
            resolve([]);
            return;
        }

        try {
            const lines = stdout.trim().split('\n');
            const processes = [];
            
            // Regex for fastlist default output: PID PPID Name
            const lineRegex = /^\s*(\d+)\s+(\d+)\s+(.+)$/;

            for (const line of lines) {
                const cleanLine = line.trim();
                const match = cleanLine.match(lineRegex);
                
                if (match) {
                    processes.push({
                        pid: parseInt(match[1], 10),
                        name: match[3].trim()
                    });
                }
            }

            // ✅ LOG HIDDEN (Uncomment for debugging)
            // console.log(`[Watcher] Scan complete. Found ${processes.length} processes.`);
            
            resolve(processes);

        } catch (err) {
            console.error('[Watcher] Parsing Error:', err);
            resolve([]);
        }
    });

    child.on('error', (err) => {
        console.error(`[Watcher] CRITICAL Spawn Error. Path: "${fastlistPath}"`, err);
        resolve([]);
    });
  });
};

class GameWatcher {
  constructor() {
    this.activeSessions = {};
    this.isRunning = false;
    this.window = null;
    this.startTimer = null;
  }

  start(window) {
    if (this.startTimer) clearTimeout(this.startTimer);

    // 🟢 UPDATED: Increased to 3000ms (3 seconds)
    // This ignores the "jitter" of startup settings toggling ON/OFF rapidly.
    this.startTimer = setTimeout(() => {
        if (this.isRunning) return;
        this.isRunning = true;
        this.window = window;
        
        // console.log('[Watcher] Native Engine Started.');
        // console.log('[Watcher] Target Binary:', fastlistPath); // ✅ DEBUG LOG
        
        this.loop();
    }, 3000);
  }

  stop() {
    if (this.startTimer) clearTimeout(this.startTimer);
    this.isRunning = false;
    // console.log('[Watcher] Service Stopped');
  }

  async loop() {
    if (!this.isRunning) return;

    await this.check();

    if (this.isRunning) {
        setTimeout(() => this.loop(), 5000); 
    }
  }

  async check() {
    try {
      const trackableGames = await db.getGamesWithExecutables();
      const activeGameIds = Object.keys(this.activeSessions);

      if (trackableGames.length === 0 && activeGameIds.length === 0) return;

      const processes = await getProcessList();
      
      // Safety: If scan failed (0 processes), DO NOT close sessions.
      // This prevents "Game Closed" bugs if the watcher glitches once.
      if (processes.length === 0) {
        // console.warn('[Watcher] Scan returned 0 processes. Skipping logic to preserve sessions.');
        return; 
      }

      const processNames = new Set(processes.map(p => p.name.toLowerCase()));

      // End Sessions
      for (const gameId of activeGameIds) {
          const session = this.activeSessions[gameId];
          // Use path.basename to extract "game.exe" from "C:\Games\game.exe"
          const isRunning = processNames.has(path.basename(session.executable).toLowerCase());
          
          if (!isRunning) {
              // console.log(`[Watcher] Game Closed: ${session.title} (Exe: ${session.executable})`);
              await this.endSession(gameId);
          }
      }

      // Start Sessions
      for (const game of trackableGames) {
          if (this.activeSessions[game.id]) continue; 

          // Use path.basename to extract "game.exe" from full path in DB
          if (processNames.has(path.basename(game.executable).toLowerCase())) {
              // console.log(`[Watcher] Game Detected: ${game.title}`);
              await this.startSession(game);
          }
      }

    } catch (error) {
      console.error('[Watcher] Check Failed:', error);
    }
  }

  async startSession(game) {
    try {
        const existing = await db.getOpenSession(game.id);
        let sessionId = null;
        let startTime = Date.now();
        
        if (existing) {
            sessionId = existing.id;
            startTime = existing.start_time; 
        } else {
            sessionId = await db.createSession(game.id, startTime);
        }

        this.activeSessions[game.id] = {
          id: sessionId,
          gameId: game.id,
          title: game.title,
          executable: game.executable,
          startTime: startTime
        };

        if (this.window && !this.window.isDestroyed()) {
          this.window.webContents.send('watcher:session-started', { 
            gameId: game.id, 
            startTime: startTime,
            sessionId: sessionId 
          });
        }
    } catch (err) {
        console.error('[Watcher] Start Session Error:', err);
    }
  }

  async endSession(gameId) {
    const session = this.activeSessions[gameId];
    if (!session) return;
    try {
        const endTime = Date.now();
        const durationMs = endTime - session.startTime;
        const durationMinutes = Math.max(1, Math.round(durationMs / 60000));
        
        await db.endSession(session.id, endTime);
        
        if (this.window && !this.window.isDestroyed()) {
          this.window.webContents.send('watcher:session-ended', { 
            gameId: session.gameId, 
            duration: durationMinutes 
          });
        }
        delete this.activeSessions[gameId];
    } catch (err) {
        console.error('[Watcher] End Session Error:', err);
    }
  }
}

export const gameWatcher = new GameWatcher();