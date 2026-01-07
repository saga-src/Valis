// Helper to safely parse JSON from DB
function safeParse(jsonString: string | null | undefined): any[] {
  if (!jsonString) return [];
  try {
    const parsed = JSON.parse(jsonString);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export const getUniqueGenres = (games: any[]) => {
  const set = new Set<string>();
  games.forEach(game => {
    // ⚡ SAFE PARSE: Handles null/undefined from SQLite
    const genres = safeParse(game.genres);
    genres.forEach((g: any) => set.add(g.name || g));
  });
  return Array.from(set).sort();
};

export const getUniquePlatforms = (games: any[]) => {
  const set = new Set<string>();
  games.forEach(game => {
    // Check metadata platforms
    const platforms = safeParse(game.platforms);
    platforms.forEach((p: any) => set.add(p.name || p.abbreviation));
  });
  return Array.from(set).sort();
};

export const getUniqueThemes = (games: any[]) => {
  const set = new Set<string>();
  games.forEach(game => {
    const themes = safeParse(game.themes);
    themes.forEach((t: any) => set.add(t.name));
  });
  return Array.from(set).sort();
};

export const getUniquePerspectives = (games: any[]) => {
  const set = new Set<string>();
  games.forEach(game => {
    const perspectives = safeParse(game.player_perspectives);
    perspectives.forEach((p: any) => set.add(p.name));
  });
  return Array.from(set).sort();
};

export const getUniqueGameModes = (games: any[]) => {
  const set = new Set<string>();
  games.forEach(game => {
    const modes = safeParse(game.game_modes);
    modes.forEach((m: any) => set.add(m.name));
  });
  return Array.from(set).sort();
};