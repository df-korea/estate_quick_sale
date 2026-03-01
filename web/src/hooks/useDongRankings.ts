'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { DongRankingItem, DongArticle } from '../types';

export function useDongRankings(limit = 10, bargainType = 'all') {
  const [data, setData] = useState<DongRankingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch<DongRankingItem[]>(`/analysis/regional-dong-rankings?limit=${limit}&bargainType=${bargainType}`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [limit, bargainType]);

  return { data, loading };
}

export function useDongArticles(division?: string, sector?: string, limit = 5) {
  const [data, setData] = useState<DongArticle[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!division || !sector) { setData([]); return; }
    setLoading(true);
    const qs = new URLSearchParams({
      division,
      sector,
      limit: String(limit),
    });
    apiFetch<DongArticle[]>(`/analysis/regional-dong-articles?${qs}`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [division, sector, limit]);

  return { data, loading };
}
