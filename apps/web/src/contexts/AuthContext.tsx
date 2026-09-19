/**
 * Auth context — localStorage-backed, mirrors mobile/src/auth.tsx pattern.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const KEY = 'gymbros.auth.v1';
const ONBOARD_KEY = 'gymbros.onboarding.v1';

interface AuthApi {
  token: string | null;
  isOnboarded: boolean;
  setToken: (token: string | null) => void;
}

const Ctx = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Read token synchronously on first render to avoid hydration mismatch
  const [token, setTokenState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  });

  const setToken = useCallback((t: string | null) => {
    setTokenState(t);
    if (t) {
      localStorage.setItem(KEY, t);
      localStorage.setItem(ONBOARD_KEY, JSON.stringify({ step: 'done' }));
    } else {
      localStorage.removeItem(KEY);
      localStorage.removeItem(ONBOARD_KEY);
    }
  }, []);

  const api = useMemo<AuthApi>(
    () => ({ token, isOnboarded: token !== null, setToken }),
    [token, setToken],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
