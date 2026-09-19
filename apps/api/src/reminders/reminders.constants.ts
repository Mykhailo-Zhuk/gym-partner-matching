export const REMINDERS_QUEUE = 'match-reminders';
export const REMINDER_JOB = 'workout-reminder';

/** Minutes before matches.scheduled_at at which a push fires (story #4). */
export const REMINDER_SLOTS_MINUTES = [60, 15] as const;
export type ReminderSlot = (typeof REMINDER_SLOTS_MINUTES)[number];

export interface ReminderJobData {
  matchId: string;
  userId: string;
  slot: ReminderSlot;
}

// --- Part 5 (#11) group matching: T-24h creator reminder ---
// Stored on the same BullMQ queue as match reminders — ponytail: one queue, two
// job shapes. The processor dispatches by the `name` field passed to queue.add().
export const GROUP_REMINDER_JOB = 'group-reminder-t24';
export const GROUP_REMINDER_HOURS_BEFORE = 24;
export interface GroupReminderJobData {
  groupId: string;
  creatorId: string;
}
