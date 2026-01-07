
export interface Platform {
  id: number;
  name: string;
  abbreviation?: string;
}

export interface PlatformOwnership {
  id: number;
  price: number;
  date_acquired?: string;
  store?: string;
}

export interface Game {
  id: string;
  name: string;
  cover_url: string | null;
  status: string;
  rating?: number;
  first_release_date?: number;
  [key: string]: any;
}

// Custom Platform IDs (Starting high to avoid IGDB collisions)
export const CUSTOM_PLATFORMS = {
  STEAM: 99001,
  EPIC: 99002,
  GOG: 99003,
  XBOX_PC: 99004,
  STANDALONE: 99005,
  PSN: 99006,
  UNOFFICIAL: 99999,
  STEAM_TOOLS: 100000
};

export const CUSTOM_PLATFORM_DATA: Record<number, Platform> = {
  [CUSTOM_PLATFORMS.STEAM]: { id: CUSTOM_PLATFORMS.STEAM, name: "Steam", abbreviation: "Steam" },
  [CUSTOM_PLATFORMS.EPIC]: { id: CUSTOM_PLATFORMS.EPIC, name: "Epic Games", abbreviation: "Epic" },
  [CUSTOM_PLATFORMS.GOG]: { id: CUSTOM_PLATFORMS.GOG, name: "GOG Galaxy", abbreviation: "GOG" },
  [CUSTOM_PLATFORMS.XBOX_PC]: { id: CUSTOM_PLATFORMS.XBOX_PC, name: "Xbox App (PC)", abbreviation: "Xbox App" },
  [CUSTOM_PLATFORMS.STANDALONE]: { id: CUSTOM_PLATFORMS.STANDALONE, name: "Standalone / Launcher", abbreviation: "Standalone Launcher" },
  [CUSTOM_PLATFORMS.PSN]: { id: CUSTOM_PLATFORMS.PSN, name: "PlayStation Network", abbreviation: "PSN" },
  [CUSTOM_PLATFORMS.UNOFFICIAL]: { id: CUSTOM_PLATFORMS.UNOFFICIAL, name: "Unofficial Copy", abbreviation: "Unofficial Copy" },
  [CUSTOM_PLATFORMS.STEAM_TOOLS]: { id: CUSTOM_PLATFORMS.STEAM_TOOLS, name: "SteamTools", abbreviation: "SteamTools" }
};
