import { useMemo } from 'react';
import { getLibrary } from '../../../lib/storage';
import { useCachedResource } from '../../../lib/cache/useCachedResource';
import { cacheKeys } from '../../../lib/cache/cacheKeys';
import { cachePolicies } from '../../../lib/cache/cachePolicy';

export const useGameDlc = (parentGameId: string | number | undefined) => {
  const resource = useCachedResource<any[]>({
    key: cacheKeys.library,
    fetcher: getLibrary,
    policy: cachePolicies.library,
    enabled: Boolean(parentGameId),
    initialData: [],
  });

  const dlcs = useMemo(() => {
    if (!parentGameId) return [];
    return (resource.data || []).filter((g: any) =>
      g.parent_game_id && String(g.parent_game_id) === String(parentGameId)
    );
  }, [parentGameId, resource.data]);

  return { dlcs, loading: resource.loading };
};
