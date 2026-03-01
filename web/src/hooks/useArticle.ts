'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { ArticleDetail, PriceHistoryEntry } from '../types';

export function useArticle(id: string | undefined) {
  const [data, setData] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiFetch<ArticleDetail>(`/articles/${id}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  return { data, loading };
}

export function usePriceHistory(id: string | undefined) {
  const [data, setData] = useState<PriceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiFetch<PriceHistoryEntry[]>(`/articles/${id}/price-history`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [id]);

  return { data, loading };
}
