export interface UserLevel {
  level: number;
  title: string;
  minXP: number;
  maxXP: number; // The XP needed for the NEXT level
  icon: string;
}

export interface Badge {
  id: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  unlocked: boolean;
}

export interface GamerActivity {
  isPlaying: boolean;
  lastPlayedGame?: { title: string; cover_url?: string };
  lastPlayedDate?: Date;
  mostPlayedGame?: { id: string; title: string; cover_url?: string; playtimeMinutes: number };
  highestRatedGame?: { id: string; title: string; cover_url?: string; score: number };
}

export interface GamerStats {
  totalGames: number;
  totalHours: number;
  gamesBeaten: number;
  mostPlayedGenre: string;
}

export interface GamerProfile {
  level: number;
  currentXp: number; // XP into current level
  nextLevelXp: number; // Total XP needed for current level
  badges: Badge[];
  activity: GamerActivity;
  stats: GamerStats;
}

export const LEVELS: UserLevel[] = [
  { level: 1, title: 'Novice', minXP: 0, maxXP: 500, icon: '🌱' },
  { level: 2, title: 'Session Tracker', minXP: 500, maxXP: 1500, icon: '⏱️' },
  { level: 3, title: 'Backlog Battler', minXP: 1500, maxXP: 3000, icon: '⚔️' },
  { level: 4, title: 'Critic', minXP: 3000, maxXP: 6000, icon: '✍️' },
  { level: 5, title: 'Curator', minXP: 6000, maxXP: 12000, icon: '🏛️' },
  { level: 6, title: 'The Architect', minXP: 12000, maxXP: 25000, icon: '👑' },
  { level: 7, title: 'Living Legend', minXP: 25000, maxXP: 999999, icon: '🌌' }
];