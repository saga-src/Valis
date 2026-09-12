import path from 'path';

export class GameLaunchCore {
  constructor(deps) {
    this.deps = deps;
    this.inFlight = new Map();
  }

  async launch(gameId) {
    const key = String(gameId);
    if (this.inFlight.has(key)) return { success: false, status: 'busy', error: 'This game is already being launched.' };
    const task = this.launchLocked(key).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, task);
    return task;
  }

  async launchLocked(gameId) {
    const game = await this.deps.getGameById(gameId);
    if (!game?.executable) return { success: false, status: 'invalid', error: 'No executable linked for this game.' };
    const executable = path.resolve(game.executable);
    const cwd = path.dirname(executable);
    try {
      const [fileStat, directoryStat] = await Promise.all([this.deps.fs.stat(executable), this.deps.fs.stat(cwd)]);
      if (!fileStat.isFile() || !directoryStat.isDirectory()) throw new Error('Invalid executable target.');
    } catch (error) {
      return { success: false, status: 'invalid', error: error.code === 'ENOENT' ? 'Executable file not found.' : error.message };
    }

    return await new Promise((resolve) => {
      let settled = false;
      let child;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(result);
      };
      const timeout = setTimeout(() => finish({ success: false, status: 'timeout', error: 'The game did not confirm startup in time.' }), this.deps.timeoutMs || 8000);
      timeout.unref?.();
      try {
        child = this.deps.spawn(executable, [], { detached: true, stdio: 'ignore', cwd, windowsHide: true });
        child.once('error', (error) => finish({ success: false, status: 'error', error: error.message }));
        child.once('spawn', async () => {
          const startedAt = Date.now();
          child.unref?.();
          try { this.deps.onStarted?.({ gameId, pid: child.pid, executable, startedAt }); } catch {}
          finish({ success: true, status: 'started', gameId, pid: child.pid, executable, startedAt });
          Promise.resolve(this.deps.incrementUserStat?.('launcher_starts', 1)).catch(() => {});
        });
      } catch (error) {
        finish({ success: false, status: 'error', error: error.message });
      }
    });
  }
}
