import { useState, useEffect } from 'react';
import { getLibrary } from '../../../lib/storage';

export const useGameDlc = (parentGameId: string | number | undefined) => {
  const [dlcs, setDlcs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDlcs = async () => {
      setLoading(true);
      try {
        const library = await getLibrary();
        
        // Find games where parent_game_id matches the current ID
        // Note: parent_game_id in DB is string or null
        const children = library.filter((g: any) => 
          g.parent_game_id && String(g.parent_game_id) === String(parentGameId)
        );

        setDlcs(children);
      } catch (e) {
        console.error("Failed to load DLCs", e);
      } finally {
        setLoading(false);
      }
    };

    if (parentGameId) {
        fetchDlcs();
    } else {
        setLoading(false);
        setDlcs([]);
    }
  }, [parentGameId]);

  return { dlcs, loading };
};