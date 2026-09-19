/**
 * Onboarding context — localStorage-backed, mirrors mobile/src/onboarding/store.tsx.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Goal, Gym, Level } from '../types';
import { storage } from '../lib/storage';

const KEY = 'gymbros.onboarding.v1';

export type OnboardingStep = 'goal' | 'level' | 'gym' | 'preview' | 'register' | 'done';

export interface OnboardingState {
  step: OnboardingStep;
  goal?: Goal;
  level?: Level;
  gym?: Pick<Gym, 'id' | 'name'> | null;
  accessToken?: string;
}

const INITIAL: OnboardingState = { step: 'goal' };

interface OnboardingApi {
  state: OnboardingState;
  hydrated: boolean;
  setGoal: (goal: Goal) => void;
  setLevel: (level: Level) => void;
  setGym: (gym: Pick<Gym, 'id' | 'name'> | null) => void;
  goTo: (step: OnboardingStep) => void;
  complete: (accessToken: string) => void;
  reset: () => void;
}

const Ctx = createContext<OnboardingApi | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>(INITIAL);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void storage
      .getItem(KEY)
      .then((raw) => {
        if (raw) setState({ ...INITIAL, ...(JSON.parse(raw) as OnboardingState) });
      })
      .catch(() => undefined)
      .finally(() => setHydrated(true));
  }, []);

  const persist = useCallback((next: OnboardingState) => {
    setState(next);
    void storage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
  }, []);

  const api = useMemo<OnboardingApi>(
    () => ({
      state,
      hydrated,
      setGoal: (goal) => persist({ ...state, goal, step: 'level' }),
      setLevel: (level) => persist({ ...state, level, step: 'gym' }),
      setGym: (gym) => persist({ ...state, gym, step: 'preview' }),
      goTo: (step) => persist({ ...state, step }),
      complete: (accessToken) => persist({ ...INITIAL, step: 'done', accessToken }),
      reset: () => persist(INITIAL),
    }),
    [state, persist, hydrated],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useOnboarding(): OnboardingApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useOnboarding outside provider');
  return ctx;
}
