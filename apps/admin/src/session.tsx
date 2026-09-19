import { createContext, useContext, useState, type ReactNode } from 'react';
import { clearTokens, getAccessToken, login as apiLogin, type ApiUser } from './api';

interface Session {
  user: ApiUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [hasToken] = useState(() => Boolean(getAccessToken()));

  // Token exists but profile unknown (page reload) — treat as signed in; API will 401 -> redirect if not.
  const value: Session = {
    user: user ?? (hasToken ? ({ id: '', email: '', name: 'Адмін', role: 'ADMIN', status: 'ACTIVE', level: null, goal: null } as ApiUser) : null),
    signIn: async (email, password) => setUser(await apiLogin(email, password)),
    signOut: () => {
      clearTokens();
      setUser(null);
      window.location.assign('/login');
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSession outside provider');
  return s;
}
