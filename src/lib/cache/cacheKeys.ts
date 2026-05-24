export const cacheKeys = {
  library: 'library',
  game: (gameId: string | number) => `game:${gameId}`,
  sessionsAll: 'sessions:all',
  sessionsForGame: (gameId: string | number) => `sessions:game:${gameId}`,
  achievementsForGame: (gameId: string | number) => `achievements:game:${gameId}`,
  analyticsCore: 'analytics:core',
  tags: 'tags',
  setting: (key: string) => `settings:${key}`,
  linkedAccounts: (platform = 'all') => `linkedAccounts:${platform}`,
  gamificationStatus: 'gamification:status',
  profileLocal: 'profile:local',
} as const;
