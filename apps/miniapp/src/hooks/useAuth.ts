import { useState, useEffect, useCallback } from 'react';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

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

  // Verify token on mount
  useEffect(() => {
    if (!token) return;
    fetch('/api/auth/me', {
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
      const { appLogin } = await import('@apps-in-toss/web-framework');
      const { authorizationCode, referrer } = await appLogin();

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorizationCode, referrer }),
      });
      if (!res.ok) throw new Error('Login failed');

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

  const logout = useCallback(async () => {
    try {
      if (token) {
        await fetch('/api/auth/logout', {
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
    logout,
  };
}

// Get token for API calls without React hook
export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
