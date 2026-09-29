import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCurrentUserId } from '../lib/currentUser';
import { travelRouteRepository } from '../services/travelRouteRepository';
import type { NewTravelRouteInput, TravelRoute } from '../types/travelRoute';

/**
 * Owns loading/adding/removing the current user's saved travel routes
 * against `travelRouteRepository`. Components stay unaware of where routes
 * are actually persisted.
 */
export function useTravelRoutes() {
  const userId = useMemo(() => getCurrentUserId(), []);
  const [routes, setRoutes] = useState<TravelRoute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await travelRouteRepository.listByUser(userId);
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setRoutes(list);
      setError(null);
    } catch {
      setError('저장된 경로를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addRoute = useCallback(
    async (input: NewTravelRouteInput) => {
      try {
        await travelRouteRepository.add(userId, input);
        await refresh();
        return true;
      } catch {
        setError('경로를 추가하지 못했습니다.');
        return false;
      }
    },
    [userId, refresh],
  );

  const removeRoute = useCallback(
    async (id: string) => {
      try {
        await travelRouteRepository.remove(id, userId);
        await refresh();
      } catch {
        setError('경로를 삭제하지 못했습니다.');
      }
    },
    [userId, refresh],
  );

  return { routes, isLoading, error, addRoute, removeRoute };
}
