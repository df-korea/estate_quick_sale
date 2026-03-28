'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { Assessment } from '../types';

export function useAssessment(articleId: string | undefined, initialData?: Assessment | null) {
  const [data, setData] = useState<Assessment | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const skipFirst = useRef(!!initialData);

  useEffect(() => {
    if (!articleId) return;
    if (skipFirst.current) { skipFirst.current = false; return; }
    setLoading(true);
    apiFetch<Assessment>(`/articles/${articleId}/assessment`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [articleId]);

  return { data, loading };
}
