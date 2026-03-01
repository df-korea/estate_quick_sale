'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { Assessment } from '../types';

export function useAssessment(articleId: string | undefined) {
  const [data, setData] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!articleId) return;
    setLoading(true);
    apiFetch<Assessment>(`/articles/${articleId}/assessment`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [articleId]);

  return { data, loading };
}
