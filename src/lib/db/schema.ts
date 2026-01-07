
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

export interface GameTable {
  id: string; // UUID
  igdb_id: number;
  title: string;
  category: number;
  parent_game_id: string | null;
  status: 'Backlog' | 'Playing' | 'Completed' | 'Dropped' | 'Shelved';
  first_release_date: number;
  summary: string;
  storyline: string;
  platforms: string; // JSON stringified array
  owned_platform_ids: string; // JSON stringified array of numbers (Legacy/Quick Access)
  platform_ownership: string; // JSON stringified array of PlatformOwnership objects
  genres: string; // JSON stringified array
  themes: string; // JSON stringified array
  involved_companies: string; // JSON stringified array
  game_engines: string; // JSON stringified array
  player_perspectives: string; // JSON stringified array
  game_modes: string; // JSON stringified array
  franchises: string; // JSON stringified array
  time_to_beat: string; // JSON stringified object
  cover_url: string;
  backdrop_url: string;
  screenshots: string; // JSON stringified array
  acquired_price: number | null; // Derived total or legacy
  final_score: number | null;
  review_metadata: string; // JSON stringified ReviewMetadata
  primary_color: string;
  executable: string | null;
  steam_id: string | null;
  xbox_store_id: string | null;
  xbox_market_id: string | null;
}

export interface SessionTable {
  id: string; // UUID
  game_id: string; // FK
  platform_id: number | null; // Platform ID played on
  start_time: string; // ISO
  end_time: string; // ISO
  duration_minutes: number;
  mood: '🤩' | '😡' | '😴' | '😭';
  notes: string; // JSON array of strings (tags)
  journal: string | null; // Long form text
}

export interface JournalTable {
  id: string; // UUID
  game_id: string; // FK
  content: string;
  entry_type: 'Review' | 'QuickNote' | 'Memory' | 'SettingsConfig';
  contains_spoilers: number; // boolean as 0/1
}

export interface Database {
  games: GameTable;
  sessions: SessionTable;
  journal_entries: JournalTable;
}
