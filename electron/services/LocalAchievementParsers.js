export function normalizeUnlockTimestamp(value, fallback = Date.now()) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return new Date(fallback).toISOString();
  const milliseconds = numeric > 10_000_000_000 ? numeric : numeric * 1000;
  const parsed = new Date(milliseconds);
  return Number.isNaN(parsed.getTime()) ? new Date(fallback).toISOString() : parsed.toISOString();
}

export function parseGoldbergAchievements(content, fallback = Date.now()) {
  const data = JSON.parse(content);
  if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('Goldberg root must be an object.');
  return Object.entries(data)
    .filter(([, stats]) => stats && (stats.earned === true || stats.completed === true || stats.unlocked === true))
    .map(([id, stats]) => ({
      id: String(id),
      unlockedAt: normalizeUnlockTimestamp(stats.earned_time || stats.unlock_time || stats.time, fallback)
    }));
}

export function parseCodexAchievements(content, fallback = Date.now()) {
  const unlocks = [];
  let inAchievements = false;
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      inAchievements = trimmed.toLowerCase().includes('achievements');
      continue;
    }
    if (!inAchievements) continue;
    const separator = trimmed.indexOf('=');
    if (separator <= 0) continue;
    const id = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().toLowerCase();
    if (id && ['1', 'true', 'yes', 'on'].includes(value)) unlocks.push({ id, unlockedAt: new Date(fallback).toISOString() });
  }
  return unlocks;
}
