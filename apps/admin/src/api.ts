/** Tiny typed client for the GymBrosUK admin API. Tokens live in localStorage (MVP). */

const ACCESS_KEY = 'gymbros_admin_access';
const REFRESH_KEY = 'gymbros_admin_refresh';

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'BLOCKED';
  level: string | null;
  goal: string | null;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export async function login(email: string, password: string): Promise<ApiUser> {
  const res = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.message ?? 'Помилка входу');
  const user = body.user as ApiUser;
  if (user.role !== 'ADMIN') throw new ApiError(403, 'Доступ лише для адміністраторів');
  setTokens(body.tokens.accessToken, body.tokens.refreshToken);
  return user;
}

async function refreshTokens(): Promise<boolean> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return false;
  try {
    const res = await fetch('/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const body = await res.json();
    setTokens(body.accessToken, body.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const call = () =>
    fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
        ...init?.headers,
      },
    });
  let res = await call();
  if (res.status === 401 && (await refreshTokens())) {
    res = await call();
  }
  if (res.status === 401) {
    clearTokens();
    window.location.assign('/login');
    throw new ApiError(401, 'Сесію завершено');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message ?? `Помилка ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---- Admin API surface (Part 1, story #3) ----

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  status: 'ACTIVE' | 'BLOCKED';
  blockedReason?: string | null;
  level: string | null;
  goal: string | null;
  gymName: string | null;
  reportsReceivedCount: number;
  createdAt: string;
}

export interface ReportItem {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
  reporter: { id: string; email: string; name: string };
}

export interface MatchItem {
  id: string;
  status: 'ACTIVE' | 'PENDING' | 'ENDED' | string;
  createdAt: string;
  partner: { id: string; name: string };
}

export interface AdminUserCard {
  profile: AdminUserRow;
  reportsReceived: ReportItem[];
  reportsFiled: ReportItem[];
  matches: MatchItem[];
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const adminApi = {
  listUsers: (q: { search?: string; status?: string; page?: number }) => {
    const params = new URLSearchParams();
    if (q.search) params.set('search', q.search);
    if (q.status) params.set('status', q.status);
    if (q.page) params.set('page', String(q.page));
    return apiFetch<Paged<AdminUserRow>>(`/admin/users?${params}`);
  },
  getUser: (id: string) => apiFetch<AdminUserCard>(`/admin/users/${id}`),
  block: (id: string, reason: string) =>
    apiFetch<{ id: string; status: string; notifiedMatchPartners: number }>(`/admin/users/${id}/block`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  unblock: (id: string) => apiFetch<{ id: string; status: string }>(`/admin/users/${id}/unblock`, { method: 'POST' }),
};
