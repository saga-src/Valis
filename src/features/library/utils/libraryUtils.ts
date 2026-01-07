
import { CUSTOM_PLATFORM_DATA } from '../../../types/index';

export const STORE_NAMES: Record<number, string> = {
  99001: "Steam",
  99002: "Epic Games",
  99003: "GOG",
  99004: "Xbox App",
  99005: "Standalone Launcher",
  99999: "Unofficial Copy",
  100000: "Steamtools"
};

/**
 * Gets the CSS variable for a given status.
 */
export const getStatusColorVar = (status: string) => {
  const s = (status || 'Backlog').toLowerCase();
  switch (s) {
    case 'playing': return 'var(--status-playing)';
    case 'beat': return 'var(--status-beat)';
    case 'backlog': return 'var(--status-backlog)';
    case 'completed': return 'var(--status-completed)';
    case 'dropped': return 'var(--status-dropped)';
    case 'shelved': return 'var(--status-shelved)';
    case 'endless': return '#8b5cf6'; // Violet/Purple (Distinct from shelves)
    default: return 'var(--muted-foreground)';
  }
};

/**
 * Sums tracked playtime and manually entered legacy playtime.
 */
export const getTrueTime = (game: any): number => {
  return (Number(game.playtime_seconds) || Number(game.total_session_seconds) || 0) + (Number(game.legacy_playtime_seconds) || 0);
};

/**
 * Checks if a game belongs to a specific platform name, handling PC stores correctly.
 */
export function checkGameHasPlatform(game: any, platformName: string): boolean {
  if (platformName === 'All') return true;

  // Explicit check for PC
  const isTargetPC = platformName === 'PC (Microsoft Windows)';
  if (isTargetPC && String(game.platform_id) === '6') return true;

  let ownedIds: any[] = [];
  try {
    if (game.owned_platform_ids) {
      ownedIds = typeof game.owned_platform_ids === 'string' 
        ? JSON.parse(game.owned_platform_ids) 
        : game.owned_platform_ids;
    }
  } catch { return false; }

  let gamePlatforms: any[] = [];
  try {
    gamePlatforms = typeof game.platforms === 'string' ? JSON.parse(game.platforms || '[]') : game.platforms || [];
  } catch { gamePlatforms = []; }

  return ownedIds.some((id: any) => {
    const numId = Number(id);
    
    // If we are looking for PC and user owns it on a PC store
    if (isTargetPC && numId >= 99000 && STORE_NAMES[numId]) return true;

    let name = '';
    const custom = CUSTOM_PLATFORM_DATA[numId];
    if (custom) {
      name = custom.name;
    } else {
      const p = gamePlatforms.find((gp: any) => gp.id === numId);
      if (p) name = p.name || p.abbreviation;
    }
    
    return name === platformName;
  });
}

/**
 * Separates physical hardware platforms from digital stores.
 */
export const resolvePlatformHardwareAndStores = (games: any[], STORE_NAMES: Record<number, string>) => {
  const hardware = new Set<string>();
  const digitalStores = new Set<string>();

  games.forEach(game => {
    if (String(game.platform_id) === '6') {
      hardware.add('PC (Microsoft Windows)');
    }

    let ownedIds: number[] = [];
    try {
      const raw = game.owned_platform_ids;
      ownedIds = typeof raw === 'string' ? JSON.parse(raw) : raw || [];
    } catch { ownedIds = []; }

    let gamePlatforms: any[] = [];
    try {
      gamePlatforms = typeof game.platforms === 'string' ? JSON.parse(game.platforms) : game.platforms || [];
    } catch { gamePlatforms = []; }

    ownedIds.forEach(id => {
      const numId = Number(id);
      if (numId >= 99000) {
        if (STORE_NAMES[numId]) {
          digitalStores.add(STORE_NAMES[numId]);
          hardware.add('PC (Microsoft Windows)');
        }
      } else {
        let name = CUSTOM_PLATFORM_DATA[numId]?.name;
        if (!name) {
          const match = gamePlatforms.find((p: any) => p.id === numId);
          name = match?.name || match?.abbreviation;
        }
        if (!name && numId === 6) name = 'PC (Microsoft Windows)';
        if (name) hardware.add(name);
      }
    });
  });

  return { 
    platforms: Array.from(hardware).sort(), 
    stores: Array.from(digitalStores).sort() 
  };
};
