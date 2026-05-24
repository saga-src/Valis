import { useCallback, useEffect, useMemo, useState } from 'react';
import { invalidateAchievementCaches, invalidateAnalyticsCaches } from '../../../lib/cache/invalidation';
import { useCacheStore } from '../../../store/cacheStore';
import { cacheKeys } from '../../../lib/cache/cacheKeys';
import { cachePolicies } from '../../../lib/cache/cachePolicy';

type SyncState = 'idle' | 'loading' | 'success' | 'error' | 'unsupported';

const hasValue = (value: any) => value !== undefined && value !== null && String(value) !== '' && String(value) !== 'undefined' && String(value) !== 'null';

const getCachedLinkedAccounts = async (platform: string) => {
  const cache = useCacheStore.getState();
  const key = cacheKeys.linkedAccounts(platform);
  if (cache.isFresh(key)) return cache.getEntry<any[]>(key)?.data || [];
  cache.setLoading(key, cachePolicies.linkedAccounts);
  try {
    const accounts = await window.api.getLinkedAccounts(platform);
    cache.setEntry(key, accounts || [], cachePolicies.linkedAccounts);
    return accounts || [];
  } catch (error) {
    cache.setError(key, error, cachePolicies.linkedAccounts);
    throw error;
  }
};

export const useManualAchievementSync = (game: any, onRefresh?: () => Promise<any>) => {
  const [linkedPlatforms, setLinkedPlatforms] = useState<Set<string>>(new Set());
  const [state, setState] = useState<SyncState>('idle');
  const [message, setMessage] = useState('');
  const [lastResult, setLastResult] = useState<any | null>(null);

  useEffect(() => {
    let active = true;
    const loadAccounts = async () => {
      if (!window.api?.getLinkedAccounts) return;
      try {
        const platforms = ['steam', 'psn', 'xbox'];
        const results = await Promise.all(platforms.map(platform => getCachedLinkedAccounts(platform)));
        if (!active) return;
        const next = new Set<string>();
        results.forEach((accounts, index) => {
          if (accounts && accounts.length > 0) next.add(platforms[index]);
        });
        setLinkedPlatforms(next);
      } catch (error) {
        console.warn('[Achievements] Failed to load linked accounts:', error);
      }
    };
    void loadAccounts();
    return () => { active = false; };
  }, []);

  const support = useMemo(() => {
    if (!game) return { supported: false, platform: 'auto', reason: 'Game is still loading.' };

    const candidates: string[] = [];
    if (hasValue(game.steam_id)) candidates.push('steam');
    if (hasValue(game.xbox_market_id) || hasValue(game.xbox_store_id)) candidates.push('xbox');
    if (hasValue(game.psn_trophy_id) || hasValue(game.psn_id)) candidates.push('psn');
    if (hasValue(game.epic_id)) candidates.push('epic');

    const platform = candidates.find(candidate => candidate !== 'epic') || candidates[0] || 'auto';
    if (platform === 'epic') {
      return { supported: false, platform, reason: 'Epic per-game sync is not available yet. Use full Epic sync from Settings.' };
    }
    if (platform === 'auto') {
      return { supported: false, platform, reason: 'No supported achievement platform ID found.' };
    }
    if (!linkedPlatforms.has(platform)) {
      return { supported: false, platform, reason: `Link a ${platform.toUpperCase()} account in Settings first.` };
    }
    return { supported: true, platform, reason: '' };
  }, [game, linkedPlatforms]);

  const sync = useCallback(async () => {
    if (!game || !support.supported || !window.api?.refreshGameAchievements) {
      setState('unsupported');
      setMessage(support.reason);
      return null;
    }

    setState('loading');
    setMessage('Syncing missing achievements...');
    setLastResult(null);

    try {
      const result = await window.api.refreshGameAchievements(game.id, {
        mode: 'lockedOnly',
        platform: support.platform as any,
      });

      setLastResult(result);
      if (!result.success) {
        setState(result.unsupported ? 'unsupported' : 'error');
        setMessage(result.error || 'Achievement sync failed.');
        return result;
      }

      invalidateAchievementCaches(game.id);
      invalidateAnalyticsCaches();
      await onRefresh?.();

      const newlyUnlocked = result.newlyUnlocked || 0;
      const definitionsUpdated = result.definitionsUpdated || 0;
      setState('success');
      setMessage(newlyUnlocked > 0
        ? `+${newlyUnlocked} newly unlocked`
        : definitionsUpdated > 0
          ? 'Already up to date'
          : 'No changes found');
      return result;
    } catch (error: any) {
      setState('error');
      setMessage(error?.message || 'Achievement sync failed.');
      return null;
    }
  }, [game, onRefresh, support]);

  return {
    sync,
    state,
    message: state === 'idle' && !support.supported ? support.reason : message,
    lastResult,
    supported: support.supported,
    platform: support.platform,
    disabledReason: support.reason,
    loading: state === 'loading',
  };
};
