'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

interface AuthUser {
  userId: number;
  userKey: string;
  nickname: string | null;
}

interface AuthContextValue {
  isLoggedIn: boolean;
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  isLoggedIn: false,
  user: null,
  token: null,
  loading: false,
  login: async () => {},
  logout: async () => {},
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

// Non-hook access for API client
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);
    if (storedToken) setToken(storedToken);
    if (storedUser) {
      try { setUser(JSON.parse(storedUser)); } catch {}
    }
    setMounted(true);
  }, []);

  // Verify token on mount
  useEffect(() => {
    if (!token || token === 'guest') return;
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    }).then(res => {
      if (!res.ok) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setToken(null);
        setUser(null);
      }
    }).catch(() => {});
  }, [token]);

  const login = useCallback(async () => {
    // Web version: Toss login is not available outside the Toss app.
    // This is a no-op on the web; auth is Toss-only.
    setLoading(true);
    try {
      throw new Error('Toss 앱에서만 로그인할 수 있습니다.');
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
    } catch {}
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, [token]);

  // Don't render children until mounted to avoid hydration mismatch
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <AuthContext.Provider value={{
      isLoggedIn: !!token && !!user,
      user,
      token,
      loading,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
