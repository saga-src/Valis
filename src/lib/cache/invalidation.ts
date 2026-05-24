import { cacheKeys } from './cacheKeys';
import { useCacheStore } from '../../store/cacheStore';
import { useLibraryStore } from '../../store/libraryStore';

export type DataChangeType =
  | 'library'
  | 'game'
  | 'session'
  | 'achievement'
  | 'gamification'
  | 'tag'
  | 'settings'
  | 'account'
  | 'restore'
  | 'reset';

export interface DataChangeEvent {
  type: DataChangeType;
  source: string;
  gameId?: string;
  sessionId?: string;
  ids?: string[];
  important: boolean;
  at: number;
}

export function invalidateLibraryCaches() {
  useCacheStore.getState().invalidate(cacheKeys.library);
  useCacheStore.getState().invalidate(cacheKeys.analyticsCore);
  useLibraryStore.getState().invalidateCache();
}

export function invalidateGameCaches(gameId?: string | number) {
  if (gameId !== undefined && gameId !== null) {
    useCacheStore.getState().invalidate(cacheKeys.game(gameId));
  }
  invalidateLibraryCaches();
}

export function invalidateSessionCaches(gameId?: string | number) {
  useCacheStore.getState().invalidate(cacheKeys.sessionsAll);
  if (gameId !== undefined && gameId !== null) {
    useCacheStore.getState().invalidate(cacheKeys.sessionsForGame(gameId));
    useCacheStore.getState().invalidate(cacheKeys.game(gameId));
  } else {
    useCacheStore.getState().invalidatePrefix('sessions:game:');
  }
  useCacheStore.getState().invalidate(cacheKeys.analyticsCore);
}

export function invalidateAchievementCaches(gameId?: string | number) {
  if (gameId !== undefined && gameId !== null) {
    useCacheStore.getState().invalidate(cacheKeys.achievementsForGame(gameId));
    useCacheStore.getState().invalidate(cacheKeys.game(gameId));
  } else {
    useCacheStore.getState().invalidatePrefix('achievements:game:');
  }
  useCacheStore.getState().invalidate(cacheKeys.analyticsCore);
  useCacheStore.getState().invalidate(cacheKeys.gamificationStatus);
}

export function invalidateAnalyticsCaches() {
  useCacheStore.getState().invalidate(cacheKeys.analyticsCore);
}

export function invalidateSettingsCaches() {
  useCacheStore.getState().invalidatePrefix('settings:');
}

export function invalidateAccountCaches() {
  useCacheStore.getState().invalidatePrefix('linkedAccounts:');
}

export function invalidateTagsCaches() {
  useCacheStore.getState().invalidate(cacheKeys.tags);
  invalidateLibraryCaches();
}

export function invalidateGamificationCaches() {
  useCacheStore.getState().invalidate(cacheKeys.gamificationStatus);
}

export function invalidateAllCaches() {
  useCacheStore.getState().clearAll();
  useLibraryStore.getState().invalidateCache();
}

export function handleDataChangeInvalidation(event: DataChangeEvent) {
  switch (event.type) {
    case 'library':
      invalidateLibraryCaches();
      break;
    case 'game':
      invalidateGameCaches(event.gameId);
      break;
    case 'session':
      invalidateSessionCaches(event.gameId);
      break;
    case 'achievement':
      invalidateAchievementCaches(event.gameId);
      break;
    case 'gamification':
      invalidateGamificationCaches();
      break;
    case 'tag':
      invalidateTagsCaches();
      break;
    case 'settings':
      invalidateSettingsCaches();
      break;
    case 'account':
      invalidateAccountCaches();
      break;
    case 'restore':
    case 'reset':
      invalidateAllCaches();
      break;
    default:
      invalidateAnalyticsCaches();
  }

  window.dispatchEvent(new CustomEvent('valis-data-update', { detail: event }));
}
