'use client';

import { useState, useCallback } from 'react';
import type { BargainSort, BargainMode } from '../types';

const STORAGE_KEY = 'app_settings';

export interface AppSettings {
  // 관심 지역
  preferredCity: string | null;
  preferredDistrict: string | null;
  // 알림 (UI only for now)
  notifyBargain: boolean;
  notifyPriceDrop: boolean;
  notifyWatchlist: boolean;
  // 표시 설정
  defaultTradeType: string;
  defaultSort: BargainSort;
  defaultBargainMode: BargainMode;
}

const DEFAULT_SETTINGS: AppSettings = {
  preferredCity: null,
  preferredDistrict: null,
  notifyBargain: true,
  notifyPriceDrop: true,
  notifyWatchlist: true,
  defaultTradeType: 'A1',
  defaultSort: 'score_desc',
  defaultBargainMode: 'all',
};

function readSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: AppSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(readSettings);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    saveSettings(DEFAULT_SETTINGS);
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return { settings, update, reset };
}
