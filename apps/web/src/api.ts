/**
 * API client — mirrors mobile/src/api.ts but uses web fetch and env var.
 */
import type {
  Goal,
  Level,
  Gym,
  PreviewCard,
  SearchCard,
  IncomingRequest,
  ChatMessagePayload,
  MatchListItem,
  DashboardData,
  Workout,
  GoalWithProgress,
  GoalMetric,
  RatingSummary,
  UserProfile,
} from './types';

export type {
  Goal,
  Level,
  Gym,
  PreviewCard,
  SearchCard,
  IncomingRequest,
  ChatMessagePayload,
  MatchListItem,
  DashboardData,
  Workout,
  GoalWithProgress,
  GoalMetric,
  RatingSummary,
  UserProfile,
};

const DEFAULT =
  (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function mkClient(token?: string | null) {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${DEFAULT}${path}`, {
      ...init,
      headers: { ...headers, ...init?.headers },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
      const msg = Array.isArray(body.message) ? body.message[0] : body.message;
      throw new ApiError(res.status, msg ?? `Помилка ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  return {
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

    getMatches: () => request<{ items: MatchListItem[] }>('/matches'),

    getMessages: (matchId: string, before?: string) => {
      const params = before ? `?before=${before}` : '';
      return request<{ items: ChatMessagePayload[]; nextCursor: string | null }>(
        `/matches/${matchId}/messages${params}`,
      );
    },

    sendMessage: (matchId: string, body: string) =>
      request<ChatMessagePayload>(`/matches/${matchId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ type: 'TEXT', body }),
      }),

    scheduleMatch: (matchId: string, scheduledAt: string | null) =>
      request<{ id: string; status: string; scheduledAt: string | null }>(
        `/matches/${matchId}/schedule`,
        { method: 'PATCH', body: JSON.stringify({ scheduledAt }) },
      ),

    enRoute: (matchId: string) =>
      request<{ ok: true; systemMessage: ChatMessagePayload }>(`/matches/${matchId}/en-route`, {
        method: 'POST',
      }),

    endMatch: (matchId: string) =>
      request<{ id: string; status: string }>(`/matches/${matchId}/end`, { method: 'POST' }),

    getDashboard: (matchId: string) =>
      request<DashboardData>(`/matches/${matchId}/dashboard`),

    addWorkout: (
      matchId: string,
      dto: { date: string; type: string; sets?: number; reps?: number; weightKg?: number },
    ) =>
      request<Workout>(`/matches/${matchId}/workouts`, {
        method: 'POST',
        body: JSON.stringify(dto),
      }),

    createGoal: (
      matchId: string,
      dto: { title: string; target: number; metric: GoalMetric; due?: string },
    ) =>
      request<GoalWithProgress>(`/matches/${matchId}/goals`, {
        method: 'POST',
        body: JSON.stringify(dto),
      }),

    confirmGoal: (matchId: string, goalId: string) =>
      request<GoalWithProgress>(`/matches/${matchId}/goals/${goalId}/confirm`, { method: 'POST' }),

    completeMatch: (
      matchId: string,
      rating?: { punctuality: number; communication: number; spotting: number; comment?: string },
    ) =>
      request<{ id: string; status: string; rating: unknown; ratingSkipped: boolean }>(
        `/matches/${matchId}/complete`,
        { method: 'POST', body: JSON.stringify(rating ? { rating } : {}) },
      ),

    getRatingSummary: (userId: string) =>
      request<RatingSummary>(`/users/${userId}/rating-summary`),

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

export const api = mkClient(null);

export function authApi(token: string) {
  return mkClient(token);
}
