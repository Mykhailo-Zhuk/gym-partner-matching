/**
 * Minimal auth token store — persisted so app survives a restart.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const KEY = 'gymbros.auth.v1';

interface AuthState {
  token: string | null;
}

interface AuthApi {
  token: string | null;
  setToken: (token: string | null) => void;
}

const Ctx = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((t) => setTokenState(t)).catch(() => undefined);
  }, []);

  const setToken = useCallback((t: string | null) => {
    setTokenState(t);
    if (t) {
      void AsyncStorage.setItem(KEY, t);
    } else {
      void AsyncStorage.removeItem(KEY);
    }
  }, []);

  const api = useMemo<AuthApi>(() => ({ token, setToken }), [token]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
