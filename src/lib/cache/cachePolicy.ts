import type { CachePolicy } from '../../store/cacheStore';

const minute = 60 * 1000;

export const cachePolicies = {
  library: { ttlMs: 10 * minute },
  gameDetails: { ttlMs: 10 * minute },
  sessions: { ttlMs: 5 * minute },
  achievements: { ttlMs: 10 * minute },
  analytics: { ttlMs: 5 * minute },
  tags: { ttlMs: 10 * minute },
  settings: { ttlMs: 10 * minute },
  linkedAccounts: { ttlMs: 10 * minute },
  gamification: { ttlMs: 5 * minute },
  route: { ttlMs: 5 * minute },
} satisfies Record<string, CachePolicy>;

export const noCachePolicy: CachePolicy = { ttlMs: 0 };
