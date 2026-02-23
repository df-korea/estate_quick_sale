import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { AnalysisOverview, LeaderboardItem, PriceChangeItem } from '../types';

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

export function useLeaderboard(limit = 10) {
  const [data, setData] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<LeaderboardItem[]>(`/analysis/bargain-leaderboard?limit=${limit}`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [limit]);

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
