export interface IGDBImage {
  url: string;
}

export interface IGDBCompany {
  id: number;
  name: string;
  logo?: IGDBImage;
}

export interface IGDBInvolvedCompany {
  id: number;
  developer: boolean;
  publisher: boolean;
  company: IGDBCompany;
}

export interface IGDBPlatform {
  id: number;
  name: string;
  abbreviation?: string;
  platform_logo?: IGDBImage;
}

export interface IGDBEngine {
  id: number;
  name: string;
  logo?: IGDBImage;
}

export interface IGDBGenre {
  id: number;
  name: string;
}

export interface IGDBTheme {
  id: number;
  name: string;
}

export interface IGDBPlayerPerspective {
  id: number;
  name: string;
}

export interface IGDBGameMode {
  id: number;
  name: string;
}

export interface IGDBTimeToBeat {
  normally?: number;
  completely?: number;
  hastily?: number; // Fixed typo
}

export interface IGDBGame {
  id: number;
  name: string;
  summary?: string;
  storyline?: string;
  first_release_date?: number; // Unix timestamp
  cover?: IGDBImage;
  screenshots?: IGDBImage[];
  genres?: IGDBGenre[];
  themes?: IGDBTheme[];
  player_perspectives?: IGDBPlayerPerspective[];
  game_modes?: IGDBGameMode[];
  platforms?: IGDBPlatform[];
  involved_companies?: IGDBInvolvedCompany[];
  game_engines?: IGDBEngine[];
  total_rating?: number;
  category?: number; // Enum 0-9
  game_type?: number; // Sometimes used interchangeably or as mapped field
  time_to_beat?: IGDBTimeToBeat;
  parent_game?: {
    id: number;
    name: string;
  };
}