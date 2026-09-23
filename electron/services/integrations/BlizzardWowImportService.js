import crypto from 'node:crypto';

const PLATFORM = 'blizzard';
const DEFAULT_REGION = 'us';
const VALID_REGIONS = new Set(['us', 'eu', 'kr', 'tw']);
const DEFAULT_WOW_GAME_ID = 'blizzard-wow-retail';
const WOW_GAME_NAMES = new Set(['worldofwarcraft', 'worldofwarcraftretail', 'wowretail']);
const AUTH_DATA_VERSION = 1;
const SECRET_KEY_PATTERN = /^(access_token|refresh_token|id_token|token|client_secret|authorization|oauth_code|auth_code)$/i;

export class BlizzardWowImportService {
  constructor(rawDb, options = {}) {
    if (!rawDb || typeof rawDb.prepare !== 'function' || typeof rawDb.transaction !== 'function') {
      throw new TypeError('BlizzardWowImportService requires a better-sqlite3 database handle.');
    }

    this.rawDb = rawDb;
    this.now = options.now || (() => Date.now());
    this.gameIdFactory = options.gameIdFactory || (() => DEFAULT_WOW_GAME_ID);
  }

  async importSnapshot(input = {}) {
    return this.importWowSnapshot(input);
  }

  async importWowSnapshot(input = {}) {
    const snapshot = input.snapshot || {};
    const account = normalizeAccount(input.account);
    const region = normalizeRegion(input.region || snapshot.region || DEFAULT_REGION);
    const selectedGameId = input.gameId || input.selectedGameId || null;
    const createNew = input.createNew === true;

    assertNoSecretKeys(snapshot, 'snapshot');
    assertNoSecretKeys(account, 'account');

    const characters = extractCharacters(snapshot);
    const achievementBundle = aggregateConfirmedAchievements(characters, snapshot);
    const snapshotStatus = normalizeSnapshotStatus(snapshot);
    const characterCount = characters.length;
    const importedAt = this.now();

    const baseCounts = {
      characters: characterCount,
      confirmedAchievements: achievementBundle.achievements.length,
      ignoredAchievements: achievementBundle.ignored,
      definitionsUpserted: 0,
      progressUpserted: 0,
      newlyUnlocked: 0,
      earlierDatesUpdated: 0
    };

    if (characterCount === 0) {
      const result = this.writeInTransaction(() => {
        this.upsertLinkedAccount(account, region, {
          status: snapshotStatus === 'partial' ? 'partial' : 'empty',
          snapshotStatus,
          gameId: null,
          characterCount,
          achievementCount: 0,
          ignoredAchievementCount: achievementBundle.ignored,
          importedAt
        });

        return {
          status: snapshotStatus === 'partial' ? 'partial' : 'empty',
          region,
          account: publicAccount(account),
          game: null,
          counts: baseCounts
        };
      });

      return result;
    }

    const resolution = this.resolveGame(selectedGameId, account.externalId, region, createNew);
    if (resolution.status === 'ambiguous') {
      return this.writeInTransaction(() => {
        this.upsertLinkedAccount(account, region, {
          status: 'ambiguous',
          snapshotStatus,
          gameId: null,
          characterCount,
          achievementCount: achievementBundle.achievements.length,
          ignoredAchievementCount: achievementBundle.ignored,
          importedAt
        });

        return {
          status: 'ambiguous',
          region,
          account: publicAccount(account),
          candidates: resolution.candidates,
          game: null,
          counts: baseCounts
        };
      });
    }

    const result = this.writeInTransaction(() => {
      const game = resolution.game || this.createWowGame(createNew);
      this.ensureBattleNetOwnership(game.id);
      const achievementStats = this.upsertAchievements(game.id, achievementBundle.achievements);

      this.upsertLinkedAccount(account, region, {
        status: snapshotStatus === 'partial' ? 'partial' : 'imported',
        snapshotStatus,
        gameId: game.id,
        characterCount,
        achievementCount: achievementBundle.achievements.length,
        ignoredAchievementCount: achievementBundle.ignored,
        importedAt
      });

      return {
        status: snapshotStatus === 'partial' ? 'partial' : 'imported',
        region,
        account: publicAccount(account),
        game: {
          id: game.id,
          name: game.name,
          created: game.created === true,
          matchedExisting: game.created !== true
        },
        counts: {
          ...baseCounts,
          ...achievementStats
        }
      };
    });

    return result;
  }

  writeInTransaction(callback) {
    const transaction = this.rawDb.transaction(callback);
    return transaction();
  }

  resolveGame(selectedGameId, accountId, region, createNew = false) {
    if (createNew) return { status: 'missing', game: null };
    if (selectedGameId) {
      const game = this.rawDb.prepare('SELECT id, name FROM games WHERE id = ?').get(String(selectedGameId));
      if (!game || !WOW_GAME_NAMES.has(normalizeGameName(game.name))) {
        throw new Error('The selected game is not a WoW Retail entry.');
      }
      return { status: 'resolved', game: { id: String(game.id), name: game.name, created: false } };
    }

    const linked = this.rawDb.prepare('SELECT auth_data FROM linked_accounts WHERE platform = ? AND external_id = ?')
      .get(PLATFORM, accountId);
    const mappedId = parseJsonObject(linked?.auth_data)?.wow?.regions?.[region]?.game_id;
    if (mappedId) {
      const mapped = this.rawDb.prepare('SELECT id, name FROM games WHERE id = ?').get(String(mappedId));
      if (mapped && WOW_GAME_NAMES.has(normalizeGameName(mapped.name))) {
        return { status: 'resolved', game: { id: String(mapped.id), name: mapped.name, created: false } };
      }
    }

    const candidates = this.findWowCandidates();
    if (candidates.length > 1) {
      return { status: 'ambiguous', candidates };
    }
    if (candidates.length === 1) {
      return { status: 'resolved', game: { ...candidates[0], created: false } };
    }

    return { status: 'missing', game: null };
  }

  findWowCandidates() {
    const rows = this.rawDb.prepare(`
      SELECT g.id, g.name, l.status
      FROM games g
      LEFT JOIN library l ON l.game_id = g.id
      ORDER BY g.name ASC, g.id ASC
    `).all();

    return rows
      .filter((row) => WOW_GAME_NAMES.has(normalizeGameName(row.name)))
      .map((row) => ({ id: String(row.id), name: row.name, status: row.status || null }));
  }

  createWowGame(forceNew = false) {
    let id = String(this.gameIdFactory() || crypto.randomUUID());
    const now = this.now();
    let existing = this.rawDb.prepare('SELECT id, name FROM games WHERE id = ?').get(id);
    if (existing && !forceNew && WOW_GAME_NAMES.has(normalizeGameName(existing.name))) {
      return { id: String(existing.id), name: existing.name, created: false };
    }
    while (existing) {
      id = `${DEFAULT_WOW_GAME_ID}:${crypto.randomUUID()}`;
      existing = this.rawDb.prepare('SELECT id FROM games WHERE id = ?').get(id);
    }

    this.rawDb.prepare(`
      INSERT INTO games (id, name, summary)
      VALUES (?, ?, ?)
    `).run(id, 'World of Warcraft', 'WoW Retail imported from a sanitized Battle.net snapshot.');

    this.rawDb.prepare(`
      INSERT INTO library (game_id, status, added_at, updated_at)
      VALUES (?, 'Backlog', ?, ?)
      ON CONFLICT(game_id) DO NOTHING
    `).run(id, now, now);

    return { id, name: 'World of Warcraft', created: true };
  }

  ensureBattleNetOwnership(gameId) {
    this.rawDb.prepare(`
      INSERT INTO library_platforms (game_id, platform_id, store_id, acquired_price)
      SELECT ?, 6, 99007, 0
      WHERE NOT EXISTS (
        SELECT 1 FROM library_platforms WHERE game_id = ? AND store_id = 99007
      )
    `).run(gameId, gameId);
  }

  upsertLinkedAccount(account, region, importState) {
    const existing = this.rawDb.prepare(`
      SELECT auth_data FROM linked_accounts
      WHERE platform = ? AND external_id = ?
    `).get(PLATFORM, account.externalId);

    const authData = mergeAuthData(existing?.auth_data, region, importState);
    const createdAt = this.now();

    this.rawDb.prepare(`
      INSERT INTO linked_accounts (platform, external_id, username, avatar_url, auth_data, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(platform, external_id) DO UPDATE SET
        username = excluded.username,
        avatar_url = excluded.avatar_url,
        auth_data = excluded.auth_data
    `).run(
      PLATFORM,
      account.externalId,
      account.username,
      account.avatarUrl,
      JSON.stringify(authData),
      createdAt
    );
  }

  upsertAchievements(gameId, achievements) {
    let definitionsUpserted = 0;
    let progressUpserted = 0;
    let newlyUnlocked = 0;
    let earlierDatesUpdated = 0;

    const upsertDefinition = this.rawDb.prepare(`
      INSERT INTO achievements (id, game_id, name, description, icon_url, is_hidden, unlocked)
      VALUES (?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(id, game_id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        icon_url = excluded.icon_url,
        is_hidden = excluded.is_hidden,
        unlocked = CASE
          WHEN achievements.unlocked = 1 OR excluded.unlocked = 1 THEN 1
          ELSE 0
        END
    `);
    const selectProgress = this.rawDb.prepare(`
      SELECT unlocked_at, session_id
      FROM achievement_progress
      WHERE game_id = ? AND achievement_id = ?
    `);
    const insertProgress = this.rawDb.prepare(`
      INSERT INTO achievement_progress (game_id, achievement_id, unlocked_at, session_id)
      VALUES (?, ?, ?, NULL)
    `);
    const updateProgress = this.rawDb.prepare(`
      UPDATE achievement_progress
      SET unlocked_at = ?
      WHERE game_id = ? AND achievement_id = ?
    `);

    for (const achievement of achievements) {
      upsertDefinition.run(
        achievement.id,
        gameId,
        achievement.name,
        achievement.description,
        achievement.iconUrl,
        achievement.isHidden ? 1 : 0
      );
      definitionsUpserted++;

      const existing = selectProgress.get(gameId, achievement.id);
      if (!existing) {
        insertProgress.run(gameId, achievement.id, achievement.unlockedAt);
        progressUpserted++;
        newlyUnlocked++;
        continue;
      }

      const existingTime = Date.parse(existing.unlocked_at || '');
      const incomingTime = Date.parse(achievement.unlockedAt);
      if (!Number.isFinite(existingTime) || incomingTime < existingTime) {
        updateProgress.run(achievement.unlockedAt, gameId, achievement.id);
        progressUpserted++;
        earlierDatesUpdated++;
      }
    }

    return {
      definitionsUpserted,
      progressUpserted,
      newlyUnlocked,
      earlierDatesUpdated
    };
  }
}

export function createBlizzardWowImportService(rawDb, options = {}) {
  return new BlizzardWowImportService(rawDb, options);
}

function normalizeRegion(region) {
  const normalized = String(region || DEFAULT_REGION).trim().toLowerCase();
  if (!VALID_REGIONS.has(normalized)) {
    throw new Error(`Unsupported Blizzard region: ${region}`);
  }
  return normalized;
}

function normalizeAccount(account) {
  if (!account || typeof account !== 'object') {
    throw new TypeError('A sanitized Blizzard account is required.');
  }

  const externalId = firstNonEmpty(account.external_id, account.externalId, account.id, account.sub);
  if (!externalId) {
    throw new Error('Blizzard account is missing a stable external id.');
  }

  return {
    externalId: String(externalId),
    username: firstNonEmpty(account.username, account.battleTag, account.displayName, account.name) || String(externalId),
    avatarUrl: firstNonEmpty(account.avatar_url, account.avatarUrl) || null
  };
}

function publicAccount(account) {
  return {
    platform: PLATFORM,
    externalId: account.externalId,
    username: account.username,
    avatarUrl: account.avatarUrl
  };
}

function extractCharacters(snapshot) {
  const candidates = [
    snapshot.characters,
    snapshot.wow?.characters,
    snapshot.profile?.characters,
    snapshot.profile?.wow?.characters
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function aggregateConfirmedAchievements(characters, snapshot) {
  const byId = new Map();
  let ignored = 0;

  const sourceLists = [
    ...characters.map(extractAchievements),
    Array.isArray(snapshot.achievements) ? snapshot.achievements : []
  ];
  for (const entries of sourceLists) {
    for (const rawAchievement of entries) {
      const blizzardId = extractAchievementId(rawAchievement);
      const unlockedAt = normalizeCompletedTimestamp(rawAchievement);
      if (!blizzardId || !unlockedAt) {
        ignored++;
        continue;
      }

      const id = `blizzard:wow:${blizzardId}`;
      const achievement = {
        id,
        blizzardId: String(blizzardId),
        name: firstNonEmpty(rawAchievement.name, rawAchievement.achievement?.name, id),
        description: firstNonEmpty(rawAchievement.description, rawAchievement.achievement?.description) || '',
        iconUrl: firstNonEmpty(rawAchievement.icon_url, rawAchievement.iconUrl, rawAchievement.icon, rawAchievement.achievement?.icon_url, rawAchievement.achievement?.icon) || '',
        isHidden: Boolean(rawAchievement.is_hidden || rawAchievement.isHidden || rawAchievement.hidden),
        unlockedAt
      };

      const existing = byId.get(id);
      if (!existing || Date.parse(achievement.unlockedAt) < Date.parse(existing.unlockedAt)) {
        byId.set(id, achievement);
      }
    }
  }

  return {
    achievements: [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)),
    ignored
  };
}

function extractAchievements(character) {
  const candidates = [
    character.achievements,
    character.achievements?.achievements,
    character.achievements?.items,
    character.achievements_completed,
    character.achievementSummary?.achievements
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function extractAchievementId(achievement) {
  return firstNonEmpty(
    achievement.id,
    achievement.achievement_id,
    achievement.achievementId,
    achievement.achievement?.id
  );
}

function normalizeCompletedTimestamp(achievement) {
  const value = firstNonEmpty(
    achievement.completed_timestamp,
    achievement.completedTimestamp,
    achievement.unlocked_at,
    achievement.unlockedAt
  );

  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    const millis = value < 10_000_000_000 ? value * 1000 : value;
    const date = new Date(millis);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }

  const numeric = /^\d+$/.test(String(value)) ? Number(value) : NaN;
  if (Number.isFinite(numeric)) return normalizeCompletedTimestamp({ completedTimestamp: numeric });
  const parsed = Date.parse(String(value));
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function normalizeSnapshotStatus(snapshot) {
  const status = String(snapshot.status || snapshot.result || '').trim().toLowerCase();
  if (status === 'partial') return 'partial';
  if (status === 'empty') return 'empty';
  if (status === 'complete') return 'complete';
  throw new Error('Invalid WoW snapshot status');
}

function mergeAuthData(existingJson, region, importState) {
  const existing = stripSecretKeys(parseJsonObject(existingJson));
  const wow = existing.wow && typeof existing.wow === 'object' ? existing.wow : {};
  const regions = wow.regions && typeof wow.regions === 'object' ? wow.regions : {};
  const previousRegion = regions[region] && typeof regions[region] === 'object' ? regions[region] : {};

  return {
    ...existing,
    version: Math.max(Number(existing.version) || AUTH_DATA_VERSION, AUTH_DATA_VERSION),
    wow: {
      ...wow,
      version: Math.max(Number(wow.version) || AUTH_DATA_VERSION, AUTH_DATA_VERSION),
      regions: {
        ...regions,
        [region]: {
          version: AUTH_DATA_VERSION,
          game_id: importState.gameId ?? previousRegion.game_id ?? null,
          status: importState.status,
          snapshot_status: importState.snapshotStatus,
          character_count: importState.characterCount,
          achievement_count: importState.achievementCount,
          ignored_achievement_count: importState.ignoredAchievementCount,
          imported_at: new Date(importState.importedAt).toISOString()
        }
      }
    }
  };
}

function parseJsonObject(json) {
  if (!json) return {};
  try {
    const parsed = typeof json === 'string' ? JSON.parse(json) : json;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function stripSecretKeys(value) {
  if (Array.isArray(value)) {
    return value.map(stripSecretKeys);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const clean = {};
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_KEY_PATTERN.test(key)) continue;
    clean[key] = stripSecretKeys(child);
  }
  return clean;
}

function assertNoSecretKeys(value, label) {
  const found = findSecretKey(value);
  if (found) {
    throw new Error(`Refusing to import unsanitized Blizzard ${label}; secret-like key "${found}" is present.`);
  }
}

function findSecretKey(value) {
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findSecretKey(child);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;

  for (const [key, child] of Object.entries(value)) {
    if (SECRET_KEY_PATTERN.test(key)) return key;
    const found = findSecretKey(child);
    if (found) return found;
  }
  return null;
}

function normalizeGameName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}
