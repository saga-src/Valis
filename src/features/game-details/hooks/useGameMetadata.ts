import { useMemo } from 'react';

export const useGameMetadata = (game: any) => {
  const safeParse = (json: any) => {
    if (!json) return [];
    try {
      const parsed = typeof json === 'string' ? JSON.parse(json) : json;
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  };

  return useMemo(() => {
    if (!game) return null;

    const companies = safeParse(game.involved_companies);

    const ttb = (() => {
      try {
        if (!game.time_to_beat) return null;
        const parsed = typeof game.time_to_beat === 'string' ? JSON.parse(game.time_to_beat) : game.time_to_beat;
        return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : null;
      } catch { return null; }
    })();
    
    return {
      genres: safeParse(game.genres).map((g: any) => g.name || g).join(', '),
      themes: safeParse(game.themes).map((t: any) => t.name || t).join(', '),
      developers: companies.filter((c: any) => c.developer).map((c: any) => c.company?.name || 'Unknown').join(', '),
      publishers: companies.filter((c: any) => c.publisher).map((c: any) => c.company?.name || 'Unknown').join(', '),
      engines: safeParse(game.game_engines).map((e: any) => e.name || e).join(', '),
      franchises: safeParse(game.franchises).map((f: any) => f.name || f).join(', '),
      perspectives: safeParse(game.player_perspectives).map((p: any) => p.name || p).join(', '),
      modes: safeParse(game.game_modes).map((m: any) => m.name || m).join(', '),
      timeToBeat: ttb,
    };
  }, [game]);
};