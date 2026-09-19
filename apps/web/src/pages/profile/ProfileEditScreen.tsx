import { useState } from 'react';
import type { Goal, Level, UserProfile } from '../../api';
import { authApi } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Screen, Title } from '../../components/ui/Screen';

const GOALS: Array<{ value: Goal; emoji: string; label: string }> = [
  { value: 'MASS', emoji: '🍗', label: 'Набір маси' },
  { value: 'CUT', emoji: '🔥', label: 'Сушка' },
  { value: 'STRENGTH', emoji: '🏋️', label: 'Сила' },
  { value: 'ENDURANCE', emoji: '🏃', label: 'Витривалість' },
  { value: 'GENERAL', emoji: '💪', label: 'Загальна форма' },
];
const LEVELS: Array<{ value: Level; emoji: string; label: string }> = [
  { value: 'BEGINNER', emoji: '🌱', label: 'Новачок' },
  { value: 'INTERMEDIATE', emoji: '⚡', label: 'Середній' },
  { value: 'ADVANCED', emoji: '🏆', label: 'Досвідчений' },
];

interface Props {
  initial: UserProfile;
  onSaved: (updated: UserProfile) => void;
  onCancel: () => void;
}

export function ProfileEditScreen({ initial, onSaved, onCancel }: Props) {
  const { token } = useAuth();
  const api = authApi(token!);

  const [name, setName] = useState(initial.name);
  const [bio, setBio] = useState(initial.bio ?? '');
  const [goal, setGoal] = useState<Goal | undefined>(initial.goal ?? undefined);
  const [level, setLevel] = useState<Level | undefined>(initial.level ?? undefined);
  const [schedule, setSchedule] = useState(initial.schedule ?? '');
  const [photoUrl, setPhotoUrl] = useState(initial.photoUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (bio.trim() === '') { setError('Про себе не може бути порожнім'); return; }
    setBusy(true);
    setError(null);
    try {
      const updated = await api.updateMe({
        name: name.trim() || undefined,
        bio: bio.trim() || undefined,
        goal,
        level,
        schedule: schedule.trim() || undefined,
        photo_url: photoUrl.trim() || undefined,
      });
      onSaved(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося зберегти');
    } finally {
      setBusy(false);
    }
  }

  const valid = name.trim().length >= 2;

  return (
    <Screen>
      <Title style={{ marginBottom: 20 }}>Редагувати профіль</Title>

      {/* Photo preview */}
      <div className="flex flex-row items-center mb-6 gap-4">
        <div className="w-[72px] h-[72px] rounded-full bg-border flex items-center justify-center overflow-hidden shrink-0">
          {photoUrl ? (
            <img src={photoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-text text-[28px] font-bold">{name[0] ?? '?'}</span>
          )}
        </div>
        <div className="flex-1">
          <p className="text-muted text-[12px] font-semibold uppercase tracking-wide mb-1">URL фото</p>
          <input
            className="w-full bg-card rounded-[12px] p-3 text-text text-[14px] border border-border"
            placeholder="https://…"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
          />
        </div>
      </div>

      <p className="text-muted text-[12px] font-semibold uppercase tracking-wide mb-1">Імʼя</p>
      <input
        className="w-full bg-card rounded-[12px] p-3 text-text text-[16px] border border-border mb-4"
        placeholder="Імʼя"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <p className="text-muted text-[12px] font-semibold uppercase tracking-wide mb-1">Про мене</p>
      <textarea
        className="w-full bg-card rounded-[12px] p-3 text-text text-[16px] border border-border mb-4 min-h-[100px] resize-none"
        placeholder="Розкажи про себе, свій досвід, цілі…"
        value={bio}
        onChange={(e) => setBio(e.target.value)}
      />

      <p className="text-muted text-[12px] font-semibold uppercase tracking-wide mb-2">Ціль</p>
      <div className="flex flex-row flex-wrap gap-2 mb-4">
        {GOALS.map((g) => (
          <button
            key={g.value}
            type="button"
            onClick={() => setGoal(goal === g.value ? undefined : g.value)}
            className={`px-4 py-2 rounded-full text-[14px] border transition-colors ${
              goal === g.value
                ? 'bg-accent border-accent text-white'
                : 'bg-card border-border text-muted'
            }`}
          >
            {g.emoji} {g.label}
          </button>
        ))}
      </div>

      <p className="text-muted text-[12px] font-semibold uppercase tracking-wide mb-2">Рівень</p>
      <div className="flex flex-row flex-wrap gap-2 mb-4">
        {LEVELS.map((l) => (
          <button
            key={l.value}
            type="button"
            onClick={() => setLevel(level === l.value ? undefined : l.value)}
            className={`px-4 py-2 rounded-full text-[14px] border transition-colors ${
              level === l.value
                ? 'bg-accent border-accent text-white'
                : 'bg-card border-border text-muted'
            }`}
          >
            {l.emoji} {l.label}
          </button>
        ))}
      </div>

      <p className="text-muted text-[12px] font-semibold uppercase tracking-wide mb-1">Вільний час</p>
      <input
        className="w-full bg-card rounded-[12px] p-3 text-text text-[16px] border border-border mb-4"
        placeholder="вечір після 18:00"
        value={schedule}
        onChange={(e) => setSchedule(e.target.value)}
      />

      {error && <p className="text-error my-3">{error}</p>}

      <div className="space-y-3 mb-10">
        <Button title={busy ? 'Зберігаємо…' : 'Зберегти'} onClick={() => void save()} disabled={!valid || busy} />
        <Button title="Скасувати" kind="ghost" onClick={onCancel} />
      </div>
    </Screen>
  );
}
