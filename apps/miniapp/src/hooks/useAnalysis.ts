import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { AnalysisOverview, LeaderboardItem, PriceChangeItem, TopPriceDropItem } from '../types';

export function useAnalysisOverview() {
  const [data, setData] = useState<AnalysisOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<AnalysisOverview>('/analysis/overview')
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
}

export function useLeaderboard(limit = 10, bargainType?: string) {
  const [data, setData] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (bargainType && bargainType !== 'all') qs.set('bargain_type', bargainType);
    setLoading(true);
    apiFetch<LeaderboardItem[]>(`/analysis/bargain-leaderboard?${qs}`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [limit, bargainType]);

  return { data, loading };
}

export function useRecentPriceChanges(limit = 10) {
  const [data, setData] = useState<PriceChangeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<PriceChangeItem[]>(`/analysis/recent-price-changes?limit=${limit}`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [limit]);

  return { data, loading };
}

export function useTopPriceDrops(limit = 10) {
  const [data, setData] = useState<TopPriceDropItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch<TopPriceDropItem[]>(`/analysis/top-price-drops?limit=${limit}`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [limit]);

  return { data, loading };
}
