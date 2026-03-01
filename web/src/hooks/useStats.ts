'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { Stats } from '../types';

export function useStats() {
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Stats>('/stats')
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
}
