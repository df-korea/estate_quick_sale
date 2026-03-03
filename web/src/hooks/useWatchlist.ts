'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, apiPost, apiDelete } from '../lib/api';
import type { WatchlistItem } from '../types';

export function useWatchlist() {
  const [data, setData] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      setData(await apiFetch<WatchlistItem[]>('/watchlist'));
    } catch {
      setData([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const add = useCallback(async (complexId: number, pyeongType?: string, propertyType?: string) => {
    try {
      await apiPost('/watchlist', {
        complex_id: complexId,
        pyeong_type: pyeongType || null,
        property_type: propertyType || 'all',
      });
      await fetchData();
    } catch (err) {
      console.error('[useWatchlist] add failed:', err);
      throw err;
    }
  }, [fetchData]);

  const remove = useCallback(async (watchlistId: number) => {
    try {
      await apiDelete(`/watchlist/${watchlistId}`);
      setData(prev => prev.filter(w => w.id !== watchlistId));
    } catch (err) {
      console.error('[useWatchlist] remove failed:', err);
    }
  }, []);

  const has = useCallback(
    (complexId: number, pyeongType?: string) =>
      data.some(w => w.complex_id === complexId && (w.pyeong_type === (pyeongType || null))),
    [data],
  );

  return { data, loading, add, remove, has, refetch: fetchData };
}
