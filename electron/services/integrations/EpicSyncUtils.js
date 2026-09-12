export const EPIC_PROGRESS_CHANNEL = 'epic:sync-progress';

export function normalizeEpicAchievementName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function matchEpicAchievement(sourceName, definitions = []) {
  const exact = definitions.filter((item) => item?.name === sourceName);
  if (exact.length === 1) return { kind: 'exact', achievement: exact[0] };
  if (exact.length > 1) return { kind: 'ambiguous', candidates: exact };

  const normalizedSource = normalizeEpicAchievementName(sourceName);
  if (!normalizedSource) return { kind: 'not_found', candidates: [] };

  const normalized = definitions.filter(
    (item) => normalizeEpicAchievementName(item?.name) === normalizedSource
  );
  if (normalized.length === 1) return { kind: 'normalized', achievement: normalized[0] };
  if (normalized.length > 1) return { kind: 'ambiguous', candidates: normalized };
  return { kind: 'not_found', candidates: [] };
}

export function parseEpicDate(value) {
  if (!value) return null;
  const cleaned = String(value).replace(/^Unlocked\s+/i, '').trim();
  const parsed = new Date(/^[A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}$/.test(cleaned) ? `${cleaned} 00:00:00 UTC` : cleaned);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function classifyEpicProfileSnapshot(snapshot = {}) {
  const links = Array.isArray(snapshot.links) ? snapshot.links : [];
  if (links.length > 0) return 'complete';

  const body = String(snapshot.bodyText || '').toLocaleLowerCase('en-US');
  if (/private|privacy settings|not public/.test(body)) return 'private';
  if (/no games|no achievements|hasn['’]t earned|0 games/.test(body)) return 'empty';
  return snapshot.selectorMatched ? 'empty' : 'error';
}

export function mergeEpicOwnership(existing = []) {
  const ownership = Array.isArray(existing) ? existing.map((entry) => ({ ...entry })) : [];
  if (!ownership.some((entry) => Number(entry.id) === 99002)) {
    ownership.push({ id: 99002, price: 0, acquired_price: 0 });
  }
  return ownership;
}

export function mergeEpicPlaytime(existing = [], seconds = 0) {
  const entries = Array.isArray(existing) ? existing.map((entry) => ({ ...entry })) : [];
  const index = entries.findIndex((entry) => String(entry.source || '').trim().toLowerCase() === 'epic');
  const safeSeconds = Math.max(0, Number(seconds) || 0);

  if (index >= 0) {
    entries[index].seconds = Math.max(Number(entries[index].seconds) || 0, safeSeconds);
  } else if (safeSeconds > 0) {
    entries.push({ source: 'Epic', platform_id: 99002, seconds: safeSeconds });
  }
  return entries;
}

export function epicSyncResult(overrides = {}) {
  return {
    success: false,
    status: 'error',
    discovered: 0,
    processed: 0,
    added: 0,
    updated: 0,
    achievementsUnlocked: 0,
    skipped: 0,
    failures: [],
    ...overrides
  };
}
