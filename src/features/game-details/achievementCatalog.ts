export function getAchievementCatalogDisplay(achievements: Array<{ id?: string | number; unlockedAt?: unknown; defaultUnlocked?: unknown }>) {
  const unlocked = achievements.filter((achievement) => achievement.unlockedAt || achievement.defaultUnlocked).length;
  const totalUnknown = achievements.some((achievement) => String(achievement.id).startsWith('blizzard:wow:'));
  return {
    unlocked,
    total: totalUnknown ? null : achievements.length,
    percentage: totalUnknown || achievements.length === 0
      ? null
      : Math.round((unlocked / achievements.length) * 100)
  };
}
