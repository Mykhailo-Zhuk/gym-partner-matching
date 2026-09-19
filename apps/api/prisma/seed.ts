/**
 * Part 0 test data — reused by QA of every part:
 *  - 2 gyms incl. "SportLife Поділ"
 *  - ~20 fake users with varied level/goal/schedule
 *  - 1 admin (env SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD)
 *  - a few ACTIVE matches + OPEN reports so the admin panel has demo data
 * Idempotent: upserts by email / gym name+city.
 */
import { Goal, Level, PrismaClient, SocialProvider } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const KYIV = 'Київ';

const FAKE_USERS: Array<{
  email: string;
  name: string;
  goal: Goal;
  level: Level;
  schedule: string;
  bio?: string;
}> = [
  { email: 'oleksii@gymbros.dev', name: 'Олексій Коваль', goal: 'MASS', level: 'BEGINNER', schedule: 'вечір після 18:00' },
  { email: 'dmytro@gymbros.dev', name: 'Дмитро Савченко', goal: 'STRENGTH', level: 'INTERMEDIATE', schedule: 'вечір після 19:00' },
  { email: 'mariia@gymbros.dev', name: 'Марія Шевченко', goal: 'CUT', level: 'BEGINNER', schedule: 'ранок 07:00–09:00' },
  { email: 'artem@gymbros.dev', name: 'Артем Бондар', goal: 'STRENGTH', level: 'ADVANCED', schedule: 'вечір після 17:00' },
  { email: 'serhii@gymbros.dev', name: 'Сергій Мельник', goal: 'MASS', level: 'INTERMEDIATE', schedule: 'вечір після 18:00' },
  { email: 'olena@gymbros.dev', name: 'Олена Кравець', goal: 'GENERAL', level: 'INTERMEDIATE', schedule: 'ранок 08:00' },
  { email: 'ivan@gymbros.dev', name: 'Іван Петренко', goal: 'MASS', level: 'BEGINNER', schedule: 'вечір після 18:00' },
  { email: 'andrii@gymbros.dev', name: 'Андрій Ткаченко', goal: 'ENDURANCE', level: 'ADVANCED', schedule: 'обід 12:00–14:00' },
  { email: 'nazar@gymbros.dev', name: 'Назар Гончар', goal: 'CUT', level: 'BEGINNER', schedule: 'вечір після 20:00' },
  { email: 'roman@gymbros.dev', name: 'Роман Білик', goal: 'MASS', level: 'INTERMEDIATE', schedule: 'ранок 06:30' },
  { email: 'sofia@gymbros.dev', name: 'Софія Литвин', goal: 'CUT', level: 'BEGINNER', schedule: 'вечір після 18:30' },
  { email: 'vitalii@gymbros.dev', name: 'Віталій Скляр', goal: 'STRENGTH', level: 'ADVANCED', schedule: 'вечір після 19:30' },
  { email: 'kate@gymbros.dev', name: 'Катерина Данилюк', goal: 'GENERAL', level: 'BEGINNER', schedule: 'ранок 09:00' },
  { email: 'max@gymbros.dev', name: 'Максим Олійник', goal: 'MASS', level: 'INTERMEDIATE', schedule: 'вечір після 18:00' },
  { email: 'yulia@gymbros.dev', name: 'Юлія Мартинюк', goal: 'ENDURANCE', level: 'INTERMEDIATE', schedule: 'ранок 07:30' },
  { email: 'taras@gymbros.dev', name: 'Тарас Шевчук', goal: 'STRENGTH', level: 'BEGINNER', schedule: 'вечір після 18:00' },
  { email: 'bohdan@gymbros.dev', name: 'Богдан Мороз', goal: 'CUT', level: 'ADVANCED', schedule: 'обід 13:00' },
  { email: 'iryna@gymbros.dev', name: 'Ірина Вознюк', goal: 'GENERAL', level: 'INTERMEDIATE', schedule: 'вечір після 19:00' },
  { email: 'vlad@gymbros.dev', name: 'Владислав Руденко', goal: 'MASS', level: 'BEGINNER', schedule: 'вечір після 18:00' },
  // Demo offender for the admin panel: has reports and an active match (story #3 scenario)
  { email: 'toxic@gymbros.dev', name: 'Токсич Токсик', goal: 'STRENGTH', level: 'INTERMEDIATE', schedule: 'вечір' },
];

async function main() {
  console.log('Seeding...');

  // --- gyms ---
  const podil = await prisma.gym.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: {},
    create: { id: '00000000-0000-4000-8000-000000000001', name: 'SportLife Поділ', city: KYIV, lat: 50.4703, lng: 30.5147 },
  });
  const lybidska = await prisma.gym.upsert({
    where: { id: '00000000-0000-4000-8000-000000000002' },
    update: {},
    create: { id: '00000000-0000-4000-8000-000000000002', name: 'SportLife Либідська', city: KYIV, lat: 50.4129, lng: 30.5242 },
  });

  // --- admin ---
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@gymbros.ua';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'admin1234';
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'Адміністратор',
      role: 'ADMIN',
      passwordHash: await bcrypt.hash(adminPassword, 10),
    },
  });
  console.log(`admin: ${adminEmail} / ${adminPassword}`);

  // --- fake users ---
  const passwordHash = await bcrypt.hash('password123', 10);
  const userIds: Record<string, string> = {};
  for (const [i, u] of FAKE_USERS.entries()) {
    const gymId = i % 3 === 2 ? lybidska.id : podil.id; // ~2/3 go to Поділ
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash, gymId },
    });
    userIds[u.email] = user.id;
  }
  console.log(`users: ${FAKE_USERS.length} (password: password123)`);

  // --- demo matches ---
  const TONIGHT_19 = new Date();
  TONIGHT_19.setHours(19, 0, 0, 0);
  if (TONIGHT_19.getTime() <= Date.now()) TONIGHT_19.setDate(TONIGHT_19.getDate() + 1);

  async function ensureMatch(
    aEmail: string,
    bEmail: string,
    status: 'ACTIVE' | 'ENDED' | 'PENDING',
    scheduledAt?: Date,
  ) {
    const userAId = userIds[aEmail];
    const userBId = userIds[bEmail];
    const existing = await prisma.match.findFirst({ where: { userAId, userBId } });
    if (!existing) await prisma.match.create({ data: { userAId, userBId, status, scheduledAt } });
    else if (scheduledAt) await prisma.match.update({ where: { id: existing.id }, data: { scheduledAt } });
  }
  // Scheduled match drives story #4 demo pushes (T-60/T-15) and the chat screen.
  await ensureMatch('oleksii@gymbros.dev', 'dmytro@gymbros.dev', 'ACTIVE', TONIGHT_19);
  await ensureMatch('artem@gymbros.dev', 'serhii@gymbros.dev', 'ACTIVE');
  await ensureMatch('toxic@gymbros.dev', 'serhii@gymbros.dev', 'ACTIVE');
  await ensureMatch('mariia@gymbros.dev', 'olena@gymbros.dev', 'ENDED');

  // --- demo reports for the admin panel ---
  const toxic = userIds['toxic@gymbros.dev'];
  const reportSeeds = [
    { reporter: 'mariia@gymbros.dev', reason: 'Недоречні повідомлення', details: 'Пише вічно про все, окрім тренувань.' },
    { reporter: 'sofia@gymbros.dev', reason: 'Харасмент', details: 'Коментував зовнішність без запрошення.' },
    { reporter: 'olena@gymbros.dev', reason: 'Недоречні повідомлення', details: 'Надсилав спам-посилання.' },
  ];
  for (const r of reportSeeds) {
    const exists = await prisma.report.findFirst({
      where: { targetId: toxic, reporterId: userIds[r.reporter], reason: r.reason },
    });
    if (!exists) {
      await prisma.report.create({
        data: { targetId: toxic, reporterId: userIds[r.reporter], reason: r.reason, details: r.details },
      });
    }
  }
  console.log('matches: 4, reports: 3 (target: toxic@gymbros.dev)');

  // --- Part 5 (#10) badge catalogue ---
  // Idempotent upsert by slug so re-running the seed never duplicates rows.
  const BADGES = [
    { slug: 'first_match', title: 'Перший крок', description: 'Завершіть перше спільне тренування', icon: '🥇', rule: 'first_match' },
    { slug: 'verified_pair', title: 'Перевірена пара', description: '5 тренувань з одним напарником', icon: '🤝', rule: 'verified_pair' },
    { slug: 'first_workout', title: 'Перший підхід', description: 'Запишіть перше тренування', icon: '💪', rule: 'first_workout' },
    { slug: 'tonnage_1k', title: 'Тоннаж', description: '1000 кг сумарно на одному матчі', icon: '🏋️', rule: 'tonnage_1k' },
    { slug: 'social_3', title: 'Амбасадор', description: 'Запросіть 3 друзів', icon: '👥', rule: 'social_3' },
    { slug: 'streak_4', title: 'Стабільність', description: '4 тижні поспіль з тренуваннями', icon: '🔥', rule: 'streak_4' },
  ];
  for (const b of BADGES) {
    await prisma.badge.upsert({ where: { slug: b.slug }, update: b, create: b });
  }
  console.log(`badges: ${BADGES.length} seeded`);

  // keep SocialProvider referenced so the enum import is used
  void SocialProvider.GOOGLE;
  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
