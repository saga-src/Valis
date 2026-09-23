import path from 'path';

export function sanitizeWatcherInterval(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 5000;
  return Math.max(1000, Math.min(60_000, Math.round(numeric)));
}

export function groupTargetsByExecutable(games) {
  const grouped = new Map();
  for (const game of games || []) {
    if (!game?.executable) continue;
    const basename = path.basename(game.executable).toLowerCase();
    const bucket = grouped.get(basename) || [];
    bucket.push(game);
    grouped.set(basename, bucket);
  }
  return grouped;
}

// A process that was already running before a game switch must not reopen the
// session it just lost. A new PID (or a process disappearing and returning)
// represents a new launch.
export function shouldStartObservedProcess({ hasScanned, previousPid, currentPid, hasActive, persistedGameId, gameId }) {
  if (hasActive) return false;
  if (!hasScanned && persistedGameId && persistedGameId !== gameId) return false;
  return previousPid !== currentPid || persistedGameId === gameId;
}

export function calculateScanStats(samples) {
  if (!samples.length) return { averageMs: 0, p95Ms: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    averageMs: Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length),
    p95Ms: sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)]
  };
}
