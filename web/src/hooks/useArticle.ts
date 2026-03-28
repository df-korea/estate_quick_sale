'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { ArticleDetail, PriceHistoryEntry } from '../types';

export function useArticle(id: string | undefined, initialData?: ArticleDetail | null) {
  const [data, setData] = useState<ArticleDetail | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const skipFirst = useRef(!!initialData);

  useEffect(() => {
    if (!id) return;
    if (skipFirst.current) { skipFirst.current = false; return; }
    setLoading(true);
    apiFetch<ArticleDetail>(`/articles/${id}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  return { data, loading };
}

export function usePriceHistory(id: string | undefined, initialData?: PriceHistoryEntry[]) {
  const [data, setData] = useState<PriceHistoryEntry[]>(initialData ?? []);
  const [loading, setLoading] = useState(!initialData);
  const skipFirst = useRef(!!initialData);

  useEffect(() => {
    if (!id) return;
    if (skipFirst.current) { skipFirst.current = false; return; }
    setLoading(true);
    apiFetch<PriceHistoryEntry[]>(`/articles/${id}/price-history`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [id]);

  return { data, loading };
}
