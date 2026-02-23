import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { WatchlistComplex } from '../types';

const STORAGE_KEY = 'watchlist_ids';

function readIds(): number[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveIds(ids: number[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function useWatchlist() {
  const [ids, setIds] = useState<number[]>(readIds);
  const [data, setData] = useState<WatchlistComplex[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (ids.length === 0) { setData([]); return; }
    setLoading(true);
    try {
      setData(await apiFetch<WatchlistComplex[]>(`/bargains/by-complexes?ids=${ids.join(',')}`));
    } catch { setData([]); }
    setLoading(false);
  }, [ids]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const add = useCallback((id: number) => {
    setIds(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      saveIds(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: number) => {
    setIds(prev => {
      const next = prev.filter(x => x !== id);
      saveIds(next);
      return next;
    });
  }, []);

  const has = useCallback((id: number) => ids.includes(id), [ids]);

  return { ids, data, loading, add, remove, has, refetch: fetchData };
}
