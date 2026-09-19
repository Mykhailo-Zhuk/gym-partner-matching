/**
 * API client — onboarding (pre-auth) + authenticated matching flow.
 */
import { Platform } from 'react-native';

const DEFAULT =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000');

// ─── Shared types ──────────────────────────────────────────────────────────────

export type Goal = 'MASS' | 'CUT' | 'STRENGTH' | 'ENDURANCE' | 'GENERAL';
export type Level = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export interface Gym {
  id: string;
  name: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
  distanceKm?: number;
}

export interface PreviewCard {
  firstName: string;
  level: Level;
  goal: Goal;
  gymName: string | null;
  schedule: string | null;
}

// ─── Auth-aware client ────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function mkClient(token?: string | null) {
  function request<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(`${DEFAULT}${path}`, {
      ...init,
      headers: { ...headers, ...init?.headers },
    }).then((r) => {
      if (!r.ok) {
        const body = (r.json().catch(() => ({})) as Promise<{ message?: string }>);
        return body.then((b) => {
          const msg = Array.isArray(b.message) ? b.message[0] : b.message;
          throw new ApiError(r.status, msg ?? `Помилка ${r.status}`);
        });
      }
      return r.json() as Promise<T>;
    });
  }

  return {
    // ── Onboarding (pre-auth) ────────────────────────────────────────────────
    gyms: (coords?: { lat: number; lng: number }) => {
      const near = coords ? `?near=${coords.lat},${coords.lng}` : '';
      return request<Gym[]>(`/gyms${near}`);
    },

    preview: (q: { goal?: Goal; level?: Level; gymId?: string }) => {
      const params = new URLSearchParams();
      if (q.goal) params.set('goal', q.goal);
      if (q.level) params.set('level', q.level);
      if (q.gymId) params.set('gym_id', q.gymId);
      return request<{ cards: PreviewCard[] }>(`/matching/preview?${params}`);
    },

    register: (payload: {
      email: string;
      password: string;
      name: string;
      goal?: Goal;
      level?: Level;
      gymId?: string;
    }) =>
      request<{ user: { id: string; email: string }; tokens: { accessToken: string; refreshToken: string } }>(
        '/auth/register',
        { method: 'POST', body: JSON.stringify(payload) },
      ),

    // ── Matching (#1) ───────────────────────────────────────────────────────
    search: (q: { level?: Level; goal?: Goal; schedule?: string; gymId?: string }) => {
      const params = new URLSearchParams();
      if (q.level) params.set('level', q.level);
      if (q.goal) params.set('goal', q.goal);
      if (q.schedule) params.set('schedule', q.schedule);
      if (q.gymId) params.set('gym_id', q.gymId);
      return request<{ cards: SearchCard[] }>(`/matching/search?${params}`);
    },

    sendRequest: (toUserId: string) =>
      request<{ id: string; status: string; createdAt: string }>('/matching/requests', {
        method: 'POST',
        body: JSON.stringify({ to_user_id: toUserId }),
      }),

    listIncomingRequests: () =>
      request<{ requests: IncomingRequest[] }>('/matching/requests/incoming'),

    acceptRequest: (requestId: string) =>
      request<{ id: string }>(`/matching/requests/${requestId}/accept`, { method: 'POST' }),

    declineRequest: (requestId: string) =>
      request<{ id: string }>(`/matching/requests/${requestId}/decline`, { method: 'POST' }),

    // ── Chat (#7) ─────────────────────────────────────────────────────────
    getMatches: () => request<{ items: MatchListItem[] }>('/matches'),

    getMessages: (matchId: string, before?: string) => {
      const params = before ? `?before=${before}` : '';
      return request<{ items: ChatMessagePayload[]; nextCursor: string | null }>(`/matches/${matchId}/messages${params}`);
    },

    sendMessage: (matchId: string, body: string) =>
      request<ChatMessagePayload>(`/matches/${matchId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ type: 'TEXT', body }),
      }),

    // ── Schedule match (#4) ────────────────────────────────────────────────
    scheduleMatch: (matchId: string, scheduledAt: string | null) =>
      request<{ id: string; status: string; scheduledAt: string | null }>(`/matches/${matchId}/schedule`, {
        method: 'PATCH',
        body: JSON.stringify({ scheduledAt }),
      }),

    enRoute: (matchId: string) =>
      request<{ ok: true; systemMessage: ChatMessagePayload }>(`/matches/${matchId}/en-route`, { method: 'POST' }),

    endMatch: (matchId: string) =>
      request<{ id: string; status: string }>(`/matches/${matchId}/end`, { method: 'POST' }),

    // ── Dashboard (#2) ─────────────────────────────────────────────────────
    getDashboard: (matchId: string) =>
      request<DashboardData>(`/matches/${matchId}/dashboard`),

    addWorkout: (matchId: string, dto: { date: string; type: string; sets?: number; reps?: number; weightKg?: number }) =>
      request<Workout>(`/matches/${matchId}/workouts`, {
        method: 'POST',
        body: JSON.stringify(dto),
      }),

    createGoal: (matchId: string, dto: { title: string; target: number; metric: GoalMetric; due?: string }) =>
      request<GoalWithProgress>(`/matches/${matchId}/goals`, {
        method: 'POST',
        body: JSON.stringify(dto),
      }),

    confirmGoal: (matchId: string, goalId: string) =>
      request<GoalWithProgress>(`/matches/${matchId}/goals/${goalId}/confirm`, { method: 'POST' }),

    // ── Ratings (#5) ───────────────────────────────────────────────────────
    completeMatch: (matchId: string, rating?: { punctuality: number; communication: number; spotting: number; comment?: string }) =>
      request<{ id: string; status: string; rating: unknown; ratingSkipped: boolean }>(`/matches/${matchId}/complete`, {
        method: 'POST',
        body: JSON.stringify(rating ? { rating } : {}),
      }),

    getRatingSummary: (userId: string) =>
      request<RatingSummary>(`/users/${userId}/rating-summary`),

    // ── Profile (#8) ────────────────────────────────────────────────────────
    getMe: () => request<UserProfile>('/users/me'),

    updateMe: (dto: {
      name?: string;
      bio?: string;
      level?: Level;
      goal?: Goal;
      schedule?: string;
      gym_id?: string;
      photo_url?: string;
    }) =>
      request<UserProfile>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify(dto),
      }),
  };
}

// ─── Extended types ───────────────────────────────────────────────────────────

export interface SearchCard {
  id: string;
  firstName: string;
  lastName?: string;
  photoUrl: string | null;
  bio: string | null;
  level: Level;
  goal: Goal;
  schedule: string | null;
  gymName: string | null;
  rating?: { average: number | null; count: number };
}

export interface IncomingRequest {
  id: string;
  fromUser: {
    id: string;
    name: string;
    photoUrl: string | null;
    level: Level;
    goal: Goal;
    gym?: { name: string } | null;
  };
  createdAt: string;
}

export interface ChatMessagePayload {
  id: string;
  matchId: string;
  senderId: string | null;
  senderName: string | null;
  type: 'TEXT' | 'IMAGE' | 'SYSTEM';
  body: string | null;
  mediaUrl: string | null;
  createdAt: string;
}

export interface MatchListItem {
  id: string;
  status: 'ACTIVE' | 'ENDED' | 'BLOCKED';
  scheduledAt: string | null;
  createdAt: string;
  partner: {
    id: string;
    name: string;
    photoUrl: string | null;
    level: Level | null;
  };
  lastMessage: ChatMessagePayload | null;
}

// ─── Dashboard / Goals / Workouts ─────────────────────────────────────────────

export type GoalMetric = 'WORKOUT_COUNT' | 'TOTAL_KG';

export interface Workout {
  id: string;
  date: string;
  type: string;
  sets: number | null;
  reps: number | null;
  weightKg: number | null;
  createdAt: string;
  user: { id: string; name: string };
}

export interface GoalWithProgress {
  id: string;
  title: string;
  target: number;
  metric: GoalMetric;
  due: string | null;
  status: 'PENDING_CONFIRM' | 'ACTIVE' | 'DONE';
  createdBy: string;
  progress: number;
}

export interface DashboardData {
  stats: {
    workoutCount: number;
    totalKg: number;
    streakWeeks: number;
  };
  goals: GoalWithProgress[];
  workouts: Workout[];
}

// ─── Ratings ─────────────────────────────────────────────────────────────────

export interface RatingSummary {
  average: number | null;
  count: number;
  comments: Array<{
    comment: string;
    createdAt: string;
    authorName: string;
    score: number;
  }>;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  level: Level | null;
  goal: Goal | null;
  schedule: string | null;
  bio: string | null;
  photoUrl: string | null;
  gym?: { id: string; name: string; city: string } | null;
}

// ─── Exported singleton (unauthenticated) + factory ────────────────────────────

export const api = mkClient(null);

/** Returns an API client bound to the given token. Use when user logs in. */
export function authApi(token: string) {
  return mkClient(token);
}
