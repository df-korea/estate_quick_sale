import { useState } from 'react';

const STORAGE_KEY = 'device_id';

function generateId(): string {
  return 'dev_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function getOrCreate(): string {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = generateId();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

export function useDeviceId(): string {
  const [id] = useState(getOrCreate);
  return id;
}
