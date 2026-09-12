import { randomUUID } from 'node:crypto';
import { BrowserWindow } from 'electron';
import epicClient from './EpicClient.js';
import { addGame, getGameById } from '../../db/modules/games.js';
import { getAchievements, updateAchievementStatusByName } from '../../db/modules/achievements.js';
import { resolveIgdbGameByEpicSlug, fetchIGDBMetadata, searchIGDB } from '../../lib/igdb.js';
import { getLinkedAccounts } from '../../db/modules/settings.js';
import {
  EPIC_PROGRESS_CHANNEL,
  epicSyncResult,
  matchEpicAchievement,
  mergeEpicOwnership,
  mergeEpicPlaytime,
  parseEpicDate
} from './EpicSyncUtils.js';

let activeSyncPromise = null;

function sanitizeTitle(title) {
  return String(title || '')
    .replace(/®|™/g, '')
    .replace(/Game of the Year Edition|GOTY/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sendProgress(sender, data) {
  if (sender && !sender.isDestroyed?.()) sender.send(EPIC_PROGRESS_CHANNEL, data);
}

async function resolveGameId(item) {
  let igdbId = null;
  try {
    igdbId = await resolveIgdbGameByEpicSlug(item.id);
  } catch {}

  if (!igdbId) {
    const searchResults = await searchIGDB(sanitizeTitle(item.title));
    if (searchResults?.length === 1) igdbId = searchResults[0].id;
  }
  return igdbId ? String(igdbId) : `epic-${item.id}`;
}

async function reconcileEpicGame(item, result) {
  const resolvedId = await resolveGameId(item);
  const existingGame = await getGameById(resolvedId);
  const epicSeconds = Math.max(0, Number(item.playtime_forever) || 0) * 60;
  const common = {
    id: resolvedId,
    epic_id: item.id,
    legacy_playtime_seconds: mergeEpicPlaytime(existingGame?.legacy_playtime_seconds, epicSeconds),
    platform_ownership: mergeEpicOwnership(existingGame?.platform_ownership),
    skip_achievement_scan: true
  };

  if (existingGame) {
    await addGame({ ...existingGame, ...common });
    result.updated += 1;
  } else {
    let metadata = null;
    if (/^\d+$/.test(resolvedId)) metadata = await fetchIGDBMetadata(resolvedId);
    await addGame({ ...metadata, ...common, name: metadata?.name || item.title });
    result.added += 1;
  }

  const definitions = await getAchievements(resolvedId);
  for (const sourceAchievement of item.unlockedAchievements || []) {
    const match = matchEpicAchievement(sourceAchievement.name, definitions);
    if (match.kind === 'ambiguous' || match.kind === 'not_found') {
      result.skipped += 1;
      result.failures.push({
        sourceId: item.id,
        title: item.title,
        code: match.kind === 'ambiguous' ? 'EPIC_ACHIEVEMENT_AMBIGUOUS' : 'EPIC_ACHIEVEMENT_NOT_FOUND',
        message: `Achievement could not be matched safely: ${sourceAchievement.name}`
      });
      continue;
    }

    const unlockedAt = parseEpicDate(sourceAchievement.rawDate);
    if (!unlockedAt) {
      result.skipped += 1;
      result.failures.push({
        sourceId: item.id,
        title: item.title,
        code: 'EPIC_ACHIEVEMENT_DATE_INVALID',
        message: `Unlock date was invalid for: ${sourceAchievement.name}`
      });
      continue;
    }

    if (match.achievement.unlockedAt) continue;
    const updated = await updateAchievementStatusByName(resolvedId, match.achievement.name, unlockedAt);
    if (updated) result.achievementsUnlocked += 1;
  }
}

async function runEpicSync(sender) {
  const correlationId = randomUUID();
  const result = epicSyncResult();
  sendProgress(sender, { message: 'Starting Epic sync...', percent: 0, correlationId });

  const accounts = await getLinkedAccounts('epic');
  const accountId = accounts.at(-1)?.external_id;
  if (!accountId) {
    return epicSyncResult({
      status: 'error',
      failures: [{ code: 'EPIC_ACCOUNT_NOT_LINKED', message: 'No linked Epic account was found.' }]
    });
  }

  const mainWindow = BrowserWindow.fromWebContents(sender);
  const clientResult = await epicClient.fetchLibrary(mainWindow, accountId, sender);
  result.status = clientResult.status;
  result.discovered = clientResult.discovered || 0;
  result.processed = clientResult.processed || 0;
  result.failures.push(...(clientResult.failures || []));

  if (clientResult.status === 'empty') {
    sendProgress(sender, { message: 'Epic library is empty.', percent: 100, correlationId });
    return { ...result, success: true };
  }
  if (!['complete', 'partial'].includes(clientResult.status)) return result;

  const games = clientResult.games || [];
  for (let index = 0; index < games.length; index += 1) {
    const item = games[index];
    sendProgress(sender, {
      message: `Importing ${index + 1} of ${games.length}: ${sanitizeTitle(item.title)}`,
      current: index + 1,
      total: games.length,
      percent: 85 + Math.round(((index + 1) / Math.max(games.length, 1)) * 14),
      correlationId,
      stage: 'reconcile'
    });
    try {
      await reconcileEpicGame(item, result);
    } catch (error) {
      result.skipped += 1;
      result.failures.push({
        sourceId: item.id,
        title: item.title,
        code: error.code || 'EPIC_GAME_RECONCILE_FAILED',
        message: error.message
      });
    }
  }

  result.processed = games.length;
  result.status = result.failures.length ? 'partial' : 'complete';
  result.success = true;
  sendProgress(sender, { message: 'Epic sync complete.', percent: 100, correlationId });
  if (result.added > 0 || result.achievementsUnlocked > 0) {
    sender.send('SOCIAL_BROADCAST_SYNC', {
      platform: 'Epic Games',
      added: result.added,
      achievements: result.achievementsUnlocked
    });
  }
  console.info(`[EpicSync:${correlationId}] status=${result.status} discovered=${result.discovered} processed=${result.processed} failures=${result.failures.length}`);
  return result;
}

export function syncEpicLibrary(sender) {
  if (activeSyncPromise) return activeSyncPromise;
  activeSyncPromise = runEpicSync(sender).finally(() => {
    activeSyncPromise = null;
  });
  return activeSyncPromise;
}
