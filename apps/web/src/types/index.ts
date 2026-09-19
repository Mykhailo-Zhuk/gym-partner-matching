// Re-export all types from the mobile API contract
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

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

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
