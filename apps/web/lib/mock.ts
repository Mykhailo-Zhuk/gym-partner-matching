// GymBrosUK — web demo (Next.js).
// Mock-only domain that mirrors the Prisma schema for a self-contained Vercel demo.
// No DB — everything lives in memory. Persistence beyond reload -> localStorage by callers.

export type Level = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type Goal = 'MASS' | 'CUT' | 'STRENGTH' | 'ENDURANCE' | 'GENERAL';

export interface Gym {
  id: string;
  name: string;
  city: string;
}

export interface Partner {
  id: string;
  name: string;
  avatar: string; // emoji avatar for the demo
  level: Level;
  goal: Goal;
  schedule: string;
  gymId: string;
  bio: string;
  ratingAverage: number | null;
  ratingCount: number;
  matchCount: number;
}

export interface ChatMessage {
  id: string;
  fromMe: boolean;
  body: string;
  at: string;
}

export interface Conversation {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar: string;
  preview: string;
  messages: ChatMessage[];
}

export const GYMS: Gym[] = [
  { id: 'podil', name: 'SportLife Поділ', city: 'Київ' },
  { id: 'lybidska', name: 'SportLife Либідська', city: 'Київ' },
];

export const LEVEL_LABEL: Record<Level, string> = {
  BEGINNER: 'Початківець',
  INTERMEDIATE: 'Середній',
  ADVANCED: 'Просунутий',
};

export const GOAL_LABEL: Record<Goal, string> = {
  MASS: 'Набір маси',
  CUT: 'Схуднення',
  STRENGTH: 'Сила',
  ENDURANCE: 'Витривалість',
  GENERAL: 'Загальна підтримка',
};

// Same cast as the seed: ~2/3 train at Поділ, rest at Либідська.
const gymFor = (i: number): string => (i % 3 === 2 ? 'lybidska' : 'podil');

const PARTNER_SEED: Array<Omit<Partner, 'gymId' | 'ratingAverage' | 'ratingCount' | 'matchCount'>> = [
  { id: 'p1', name: 'Олексій Коваль', avatar: '🧔', level: 'BEGINNER', goal: 'MASS', schedule: 'вечір після 18:00', bio: 'Хочу набрати масу, шукаю напарника на вечірні тренування.' },
  { id: 'p2', name: 'Дмитро Савченко', avatar: '💪', level: 'INTERMEDIATE', goal: 'STRENGTH', schedule: 'вечір після 19:00', bio: 'Силові 4 рази на тиждень. Люблю базову програму.' },
  { id: 'p3', name: 'Марія Шевченко', avatar: '🧘‍♀️', level: 'BEGINNER', goal: 'CUT', schedule: 'ранок 07:00', bio: 'Схуднення + фулбоді. Цікаво з напарницею.' },
  { id: 'p4', name: 'Артем Бондар', avatar: '🏋️', level: 'ADVANCED', goal: 'STRENGTH', schedule: 'вечір після 17:00', bio: 'Пауерліфтинг, жим 140. Шукаю серйозну пару.' },
  { id: 'p5', name: 'Сергій Мельник', avatar: '🤺', level: 'INTERMEDIATE', goal: 'MASS', schedule: 'вечір після 18:00', bio: 'Маю 2 роки стажу, хочу більшої маси й дисципліни.' },
  { id: 'p6', name: 'Олена Кравець', avatar: '🦾', level: 'INTERMEDIATE', goal: 'GENERAL', schedule: 'ранок 08:00', bio: 'Загальна підтримка форми, легкий кардіо + силові.' },
  { id: 'p7', name: 'Іван Петренко', avatar: '🤗', level: 'BEGINNER', goal: 'MASS', schedule: 'вечір після 18:00', bio: 'Новачок, дуже мотивований, хочу з ким ходити регулярно.' },
  { id: 'p8', name: 'Андрій Ткаченко', avatar: '🏃', level: 'ADVANCED', goal: 'ENDURANCE', schedule: 'обід 12:00', bio: 'Функціоналка, витривалість, кросфіт.' },
  { id: 'p9', name: 'Назар Гончар', avatar: '🔥', level: 'BEGINNER', goal: 'CUT', schedule: 'вечір після 20:00', bio: 'Після скидання 10 кг хочу тримати темп із напарником.' },
  { id: 'p10', name: 'Роман Білик', avatar: '🧊', level: 'INTERMEDIATE', goal: 'MASS', schedule: 'ранок 06:30', bio: 'Ранкові тренування, 5×5 схема.' },
  { id: 'p11', name: 'Софія Литвин', avatar: '🌸', level: 'BEGINNER', goal: 'CUT', schedule: 'вечір після 18:30', bio: 'Двічі на тиждень, починаю серйозно.' },
  { id: 'p12', name: 'Віталій Скляр', avatar: '⚡', level: 'ADVANCED', goal: 'STRENGTH', schedule: 'вечір після 19:30', bio: 'Тренер модальний 3 роки, стажу, строга програма.' },
];

export const PARTNERS: Partner[] = PARTNER_SEED.map((p, i) => ({
  ...p,
  gymId: gymFor(i),
  ratingAverage: Math.round((3.6 + ((i * 7) % 15) / 10) * 10) / 10,
  ratingCount: 1 + ((i * 3) % 40),
  matchCount: i % 4,
}));

export const ME = {
  id: 'me',
  name: 'Тарас',
  avatar: '🙂',
  level: 'INTERMEDIATE' as Level,
  goal: 'STRENGTH' as Goal,
  schedule: 'вечір після 18:00',
  gymId: 'podil',
  bio: 'Силові + трохи кардіо. Шукаю стабільного партнера.',
};

export interface SearchFilters {
  goal?: Goal;
  level?: Level;
  schedule?: string;
  gymId?: string;
}

/** Mirror matching.service.search: filter active partners, return up to N. */
export function searchPartners(filters: SearchFilters, take = 12): Partner[] {
  const f = (filters.goal && filters.level) || filters.goal || filters.level ? filters : filters;
  return PARTNERS.filter((p) => {
    if (filters.goal && p.goal !== filters.goal) return false;
    if (filters.level && p.level !== filters.level) return false;
    if (filters.schedule && !p.schedule.toLowerCase().includes(filters.schedule.toLowerCase())) return false;
    if (filters.gymId && p.gymId !== filters.gymId) return false;
    return true;
  }).slice(0, take);
}

/** Anonymized preview cards — show first name only, no id/email (mirrors /matching/preview). */
export interface PreviewCard {
  firstName: string;
  avatar: string;
  level: Level;
  goal: Goal;
  gymName: string | null;
  schedule: string;
  ratingAverage: number | null;
  ratingCount: number;
}

export function previewCards(filters: { goal?: Goal; level?: Level; gymId?: string } = {}, take = 5): PreviewCard[] {
  return searchPartners(filters as SearchFilters, 20).slice(0, take).map((p) => ({
    firstName: p.name.split(' ')[0] || 'Користувач',
    avatar: p.avatar,
    level: p.level,
    goal: p.goal,
    gymName: GYMS.find((g) => g.id === p.gymId)?.name ?? null,
    schedule: p.schedule,
    ratingAverage: p.ratingAverage,
    ratingCount: p.ratingCount,
  }));
}

// ---- Chat (mirrors Part 3) ----

export const CONVERSATIONS: Conversation[] = [
  {
    id: 'c1',
    partnerId: 'p2',
    partnerName: 'Дмитро Савченко',
    partnerAvatar: '💪',
    preview: 'Ок, бачимось о 19:00! 🔥',
    messages: [
      { id: 'm1', fromMe: true, body: 'Привіт! Встигаєш сьогодні о 19:00?', at: '12:10' },
      { id: 'm2', fromMe: false, body: 'Так, якраз закінчую роботу. Жим на сьогодні?', at: '12:14' },
      { id: 'm3', fromMe: true, body: 'Так, зробимо жим + плечі.', at: '12:15' },
      { id: 'm4', fromMe: false, body: 'Ок, бачимось о 19:00! 🔥', at: '12:16' },
    ],
  },
  {
    id: 'c2',
    partnerId: 'p5',
    partnerName: 'Сергій Мельник',
    partnerAvatar: '🤺',
    preview: 'Запиши мене на завтра',
    messages: [
      { id: 'm1', fromMe: true, body: 'Сергію, ти на завтра на 18:00?', at: 'вчора' },
      { id: 'm2', fromMe: false, body: 'Запиши мене на завтра', at: 'вчора' },
    ],
  },
  {
    id: 'c3',
    partnerId: 'p7',
    partnerName: 'Іван Петренко',
    partnerAvatar: '🤗',
    preview: 'Дякую за пораду!',
    messages: [
      { id: 'm1', fromMe: false, body: 'Дякую за пораду про програму!', at: 'пн' },
    ],
  },
];

// ---- Dashboard (mirrors Part 4) ----

export interface DashboardStats {
  workoutsThisWeek: number;
  totalKg: number;
  streakWeeks: number;
  withPartner: number;
}

export const DASHBOARD: DashboardStats = {
  workoutsThisWeek: 4,
  totalKg: 12450,
  streakWeeks: 6,
  withPartner: 3,
};

export interface Badge {
  slug: string;
  title: string;
  description: string;
  icon: string;
  earned: boolean;
}

export const BADGES: Badge[] = [
  { slug: 'first_match', title: 'Перший крок', description: 'Завершіть перше спільне тренування', icon: '🥇', earned: true },
  { slug: 'first_workout', title: 'Перший підхід', description: 'Запишіть перше тренування', icon: '💪', earned: true },
  { slug: 'streak_4', title: 'Стабільність', description: '4 тижні поспіль з тренуваннями', icon: '🔥', earned: true },
  { slug: 'tonnage_1k', title: 'Тоннаж', description: '1000 кг сумарно на одному матчі', icon: '🏋️', earned: true },
  { slug: 'verified_pair', title: 'Перевірена пара', description: '5 тренувань з одним напарником', icon: '🤝', earned: false },
  { slug: 'social_3', title: 'Амбасадор', description: 'Запросіть 3 друзів', icon: '👥', earned: false },
];

export interface WorkoutRow {
  date: string;
  type: string;
  sets: number;
  reps: number;
  weightKg: number;
  kg: number;
}

export const THIS_WEEK: WorkoutRow[] = [
  { date: 'Пн', type: 'Груди', sets: 5, reps: 5, weightKg: 100, kg: 2500 },
  { date: 'Ср', type: 'Спина', sets: 4, reps: 8, weightKg: 90, kg: 2880 },
  { date: 'Пт', type: 'Плечі', sets: 4, reps: 10, weightKg: 55, kg: 2200 },
  { date: 'Сб', type: 'Ноги', sets: 5, reps: 5, weightKg: 120, kg: 3000 },
];

// ---- Preserved product routes (from the 3-app monorepo), mock-backed ----

export interface MatchListItem {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar: string;
  status: 'ACTIVE' | 'ENDED';
  scheduledAt: string | null;
  lastMessage: string;
}

export const MY_PAIRS: MatchListItem[] = [
  { id: 'm1', partnerId: 'p2', partnerName: 'Дмитро Савченко', partnerAvatar: '💪', status: 'ACTIVE', scheduledAt: 'Сьогодні 19:00', lastMessage: 'Ок, бачимось о 19:00! 🔥' },
  { id: 'm2', partnerId: 'p5', partnerName: 'Сергій Мельник', partnerAvatar: '🤺', status: 'ACTIVE', scheduledAt: 'Завтра 18:00', lastMessage: 'Запиши мене на завтра' },
  { id: 'm3', partnerId: 'p7', partnerName: 'Іван Петренко', partnerAvatar: '🤗', status: 'ACTIVE', scheduledAt: null, lastMessage: 'Дякую за пораду!' },
];

export interface IncomingRequest {
  id: string;
  fromName: string;
  fromAvatar: string;
  level: Level;
  goal: Goal;
  gymName: string;
  at: string;
}

export const REQUESTS_INBOX: IncomingRequest[] = [
  { id: 'r1', fromName: 'Богдан Мороз', fromAvatar: '🧊', level: 'ADVANCED', goal: 'CUT', gymName: 'SportLife Поділ', at: '2 год тому' },
  { id: 'r2', fromName: 'Ірина Вознюк', fromAvatar: '🌿', level: 'INTERMEDIATE', goal: 'GENERAL', gymName: 'SportLife Либідська', at: '5 год тому' },
  { id: 'r3', fromName: 'Владислав Руденко', fromAvatar: '⚡', level: 'BEGINNER', goal: 'MASS', gymName: 'SportLife Поділ', at: 'вчора' },
];

export interface ScheduledSlot {
  id: string;
  day: string;
  time: string;
  partnerName: string;
}

export const SCHEDULE: ScheduledSlot[] = [
  { id: 's1', day: 'Понеділок', time: '19:00', partnerName: 'Дмитро Савченко' },
  { id: 's2', day: 'Середа', time: '18:00', partnerName: 'Сергій Мельник' },
  { id: 's3', day: 'Субота', time: '10:00', partnerName: 'Іван Петренко' },
];

export const WORKOUT_TYPES = ['Груди', 'Спина', 'Плечі', 'Ноги', 'Руки', 'Кардіо'];
export const GOAL_METRICS = ['WORKOUT_COUNT', 'TOTAL_KG'];

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  status: 'ACTIVE' | 'BLOCKED';
  level: Level;
  goal: Goal;
  gymName: string;
  reports: number;
}

export const ADMIN_USERS: AdminUserRow[] = [
  { id: 'a1', email: 'toxic@gymbros.dev', name: 'Токсич Токсик', status: 'BLOCKED', level: 'INTERMEDIATE', goal: 'STRENGTH', gymName: 'SportLife Поділ', reports: 3 },
  { id: 'a2', email: 'oleksii@gymbros.dev', name: 'Олексій Коваль', status: 'ACTIVE', level: 'BEGINNER', goal: 'MASS', gymName: 'SportLife Поділ', reports: 0 },
  { id: 'a3', email: 'dmytro@gymbros.dev', name: 'Дмитро Савченко', status: 'ACTIVE', level: 'INTERMEDIATE', goal: 'STRENGTH', gymName: 'SportLife Поділ', reports: 0 },
  { id: 'a4', email: 'mariia@gymbros.dev', name: 'Марія Шевченко', status: 'ACTIVE', level: 'BEGINNER', goal: 'CUT', gymName: 'SportLife Поділ', reports: 1 },
  { id: 'a5', email: 'andrii@gymbros.dev', name: 'Андрій Ткаченко', status: 'ACTIVE', level: 'ADVANCED', goal: 'ENDURANCE', gymName: 'SportLife Либідська', reports: 0 },
];

export const ADMIN_LOGIN = { email: 'admin@gymbros.dev', password: 'admin1234' };
