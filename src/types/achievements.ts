/**
 * Standard representation of a game achievement across all platforms.
 */
export interface Achievement {
  /** Unique identifier for the achievement (usually from the source platform) */
  id: string;
  /** Display name of the achievement */
  name: string;
  /** Description or requirement to unlock */
  description: string;
  /** URL to the achievement icon */
  iconUrl: string;
  /** ISO Date string representing when the achievement was unlocked, if applicable */
  unlockedAt?: string;
  /** Whether the achievement is hidden (spoiler protection) */
  isHidden?: boolean;
  /** Rarity percentage (0-100) based on global player base */
  rarity?: number;
}

/**
 * Abstract class for implementing achievement data sources.
 * Specialized providers (e.g. SteamAchievementProvider) should extend this.
 */
export abstract class AchievementProvider {
  /** The display name of the provider */
  abstract name: string;

  /**
   * Fetches achievements for a specific game.
   * @param gameId The internal or IGDB identifier of the game.
   * @param config Optional platform-specific configuration (e.g. API keys, user IDs).
   */
  abstract getAchievements(gameId: string, config?: any): Promise<Achievement[]>;
}
