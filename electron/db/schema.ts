export interface ReviewMetadata {
  method: 'CRITICAL' | 'CASUAL';
  genre_template: string;
  criteria_scores: Record<string, number>;
  informational: {
    difficulty: string;
    playtime: string;
    bugs: string;
    age_rating: string;
  };
  calculated_average: number;
  suggested_range: string;
}

export interface GamesTable {
  id: string; 
  name: string;
  cover_url: string | null;
  backdrop_url: string | null;
  summary: string | null;
  storyline: string | null;
  first_release_date: number | null;
  rating: number | null; 
  game_type: number | null;
  parent_game_id: string | null;
  genres: string | null; // JSON
  themes: string | null; // JSON
  involved_companies: string | null; // JSON
  game_engines: string | null; // JSON
  player_perspectives: string | null; // JSON
  game_modes: string | null; // JSON
  platforms: string | null; // JSON (IGDB available platforms)
  franchises: string | null; // JSON
  time_to_beat: string | null; // JSON
  screenshots: string | null; // JSON
  primary_color: string | null;
  steam_id: string | null;
  epic_id: string | null;
  psn_id: string | null;
  psn_trophy_id: string | null;
  xbox_store_id: string | null;
  xbox_market_id: string | null;
  dlcs: string | null; // JSON
  local_cover_path: string | null;
}

export interface LibraryTable {
  game_id: string;
  status: 'Backlog' | 'Playing' | 'Beat' | 'Completed' | 'Dropped' | 'Shelved' | 'Endless';
  final_score: number | null;
  rating: number | null; // User Rating 0-5
  review_text: string | null;
  review_metadata: string | null; // JSON
  playtime_seconds: number;
  legacy_playtime_seconds: number;
  added_at: number;
  updated_at: number;
  executable_path: string | null;
  date_started: number | null;
  date_beaten: number | null;
  date_completed: number | null;
  date_dropped: number | null;
  date_endless: number | null;
}

export interface LibraryPlatformsTable {
  id: number;
  game_id: string;
  platform_id: number | null;
  store_id: number | null;
  acquired_price: number;
  acquired_at: number | null;
}

export interface SessionsTable {
  id: string;
  game_id: string;
  start_time: number;
  end_time: number | null;
  duration_seconds: number;
  notes: string | null; 
  journal_text: string | null;
  platform_id: number | null;
  mood: string | null;
}

export interface SettingsTable {
  key: string;
  value: string; // JSON
}

export interface AchievementsTable {
  id: string;
  game_id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  is_hidden: number; // 0 or 1
  unlocked: number; // 0 or 1
}

export interface AchievementProgressTable {
  game_id: string;
  achievement_id: string;
  unlocked_at: string | null; // ISO Date string
  session_id: string | null;
}

export interface WatchPathsTable {
  id: number; // integer primary key autoincrement
  path: string;
  type: 'goldberg' | 'codex';
  recursive: number; // 0 or 1
}

export interface LinkedAccountsTable {
  id: number;
  platform: string;
  external_id: string;
  username: string | null;
  avatar_url: string | null;
  auth_data: string | null;
  created_at: number;
}

export interface GameTagsTable {
  game_id: string;
  tag_name: string;
  usage_count: number;
}

export interface SystemMetaTable {
  key: string;
  value: string;
}

export interface TagsTable {
  id: number;
  name: string;
  color: string | null;
}

export interface GameLibraryTagsTable {
  game_id: string;
  tag_id: number;
}

export interface Database {
  games: GamesTable;
  library: LibraryTable;
  library_platforms: LibraryPlatformsTable;
  sessions: SessionsTable;
  settings: SettingsTable;
  achievements: AchievementsTable;
  achievement_progress: AchievementProgressTable;
  watch_paths: WatchPathsTable;
  linked_accounts: LinkedAccountsTable;
  game_tags: GameTagsTable;
  system_meta: SystemMetaTable;
  tags: TagsTable;
  game_library_tags: GameLibraryTagsTable;
}