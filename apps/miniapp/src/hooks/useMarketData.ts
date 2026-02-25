import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { PriceTrendItem } from '../types';

interface TrendParams {
  aptNm?: string;
  sggCd?: string;
  excluUseAr?: number;
  months?: number;
}

export function usePriceTrend(params: TrendParams) {
  const [data, setData] = useState<PriceTrendItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const qs = new URLSearchParams();
    if (params.aptNm) qs.set('aptNm', params.aptNm);
    if (params.sggCd) qs.set('sggCd', params.sggCd);
    if (params.excluUseAr) qs.set('excluUseAr', String(params.excluUseAr));
    if (params.months) qs.set('months', String(params.months));

    apiFetch<PriceTrendItem[]>(`/real-transactions/price-trend?${qs}`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [params.aptNm, params.sggCd, params.excluUseAr, params.months]);

  return { data, loading };
}
