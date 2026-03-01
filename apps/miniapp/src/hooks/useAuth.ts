import { useState, useEffect, useCallback } from 'react';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
// Toss WebView에서는 .ait가 토스 CDN에서 로드되므로 절대 URL 필요
const API_BASE = import.meta.env.DEV
  ? ''
  : 'https://estate-rader.com';

interface AuthUser {
  userId: number;
  userKey: string;
  nickname: string | null;
}

interface AuthState {
  isLoggedIn: boolean;
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: () => Promise<void>;
  loginAsGuest: () => void;
  logout: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  // Verify token on mount (skip for guest)
  useEffect(() => {
    if (!token || token === 'guest') return;
    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(res => {
      if (!res.ok) {
        // Token expired or invalid
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setToken(null);
        setUser(null);
      }
    }).catch(() => {});
  }, []);

  const login = useCallback(async () => {
    setLoading(true);
    try {
      // Step 1: 동적 import
      let appLogin: () => Promise<{ authorizationCode: string; referrer: string }>;
      try {
        const mod = await import('@apps-in-toss/web-framework');
        appLogin = mod.appLogin;
      } catch (e) {
        throw new Error(`[import] ${e instanceof Error ? e.message : e}`);
      }

      // Step 2: 토스 네이티브 브릿지
      let authorizationCode: string;
      let referrer: string;
      try {
        const result = await appLogin();
        authorizationCode = result.authorizationCode;
        referrer = result.referrer;
      } catch (e) {
        throw new Error(`[appLogin] ${e instanceof Error ? e.message : e}`);
      }

      // Step 3: API 호출
      let res: Response;
      try {
        res = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ authorizationCode, referrer }),
        });
      } catch (e) {
        throw new Error(`[fetch] ${e instanceof Error ? e.message : e}`);
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`[API ${res.status}] ${body || res.statusText}`);
      }

      const data = await res.json();
      const authUser: AuthUser = {
        userId: data.userId,
        userKey: data.userKey,
        nickname: data.nickname,
      };

      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(authUser));
      setToken(data.token);
      setUser(authUser);
    } catch (e) {
      console.error('[useAuth] login error:', e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const loginAsGuest = useCallback(() => {
    const guestUser: AuthUser = { userId: 0, userKey: 'guest', nickname: '게스트' };
    localStorage.setItem(TOKEN_KEY, 'guest');
    localStorage.setItem(USER_KEY, JSON.stringify(guestUser));
    setToken('guest');
    setUser(guestUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      if (token) {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
      // ignore
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, [token]);

  return {
    isLoggedIn: !!token && !!user,
    user,
    token,
    loading,
    login,
    loginAsGuest,
    logout,
  };
}

// Get token for API calls without React hook
export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
