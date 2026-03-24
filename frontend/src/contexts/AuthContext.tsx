import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, type UserInfo } from '@/lib/api';

interface AuthContextType {
  user: UserInfo | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi.getMe()
      .then((me) => setUser(me.is_authenticated ? me : null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const u = await authApi.login(username, password);
    setUser(u.is_authenticated ? u : null);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    window.location.href = '/auth/login';
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
