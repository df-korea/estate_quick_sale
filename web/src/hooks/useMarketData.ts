'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { PriceTrendItem, IndividualTransaction } from '../types';

interface TrendParams {
  aptNm?: string;
  sggCd?: string;
  excluUseAr?: number;
  months?: number;
  complexId?: number;
  initialData?: PriceTrendItem[];
}

export function usePriceTrend(params: TrendParams) {
  const [data, setData] = useState<PriceTrendItem[]>(params.initialData ?? []);
  const [loading, setLoading] = useState(!params.initialData);
  const skipFirst = useRef(!!params.initialData);

  useEffect(() => {
    if (skipFirst.current) { skipFirst.current = false; return; }
    const qs = new URLSearchParams();
    if (params.complexId) qs.set('complexId', String(params.complexId));
    else if (params.aptNm) qs.set('aptNm', params.aptNm);
    if (!params.complexId && params.sggCd) qs.set('sggCd', params.sggCd);
    if (params.excluUseAr) qs.set('excluUseAr', String(params.excluUseAr));
    if (params.months) qs.set('months', String(params.months));

    setLoading(true);
    apiFetch<PriceTrendItem[]>(`/real-transactions/price-trend?${qs}`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [params.aptNm, params.sggCd, params.excluUseAr, params.months, params.complexId]);

  return { data, loading };
}

interface IndividualTxParams {
  aptNm?: string;
  sggCd?: string;
  excluUseAr?: number;
  months?: number;
  complexId?: number;
  initialData?: IndividualTransaction[];
}

export function useIndividualTransactions(params: IndividualTxParams) {
  const [data, setData] = useState<IndividualTransaction[]>(params.initialData ?? []);
  const [loading, setLoading] = useState(!params.initialData);
  const skipFirst = useRef(!!params.initialData);

  useEffect(() => {
    if (skipFirst.current) { skipFirst.current = false; return; }
    if (!params.aptNm && !params.complexId) { setData([]); setLoading(false); return; }
    const qs = new URLSearchParams();
    if (params.complexId) qs.set('complexId', String(params.complexId));
    else if (params.aptNm) qs.set('aptNm', params.aptNm);
    if (!params.complexId && params.sggCd) qs.set('sggCd', params.sggCd);
    if (params.excluUseAr) qs.set('excluUseAr', String(params.excluUseAr));
    if (params.months) qs.set('months', String(params.months));

    setLoading(true);
    apiFetch<IndividualTransaction[]>(`/real-transactions/individual?${qs}`)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [params.aptNm, params.sggCd, params.excluUseAr, params.months, params.complexId]);

  return { data, loading };
}
