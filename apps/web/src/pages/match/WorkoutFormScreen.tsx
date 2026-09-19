import { useState } from 'react';
import type { MatchListItem } from '../../api';
import { authApi } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Screen, Title } from '../../components/ui/Screen';

const WORKOUT_TYPES = ['груди', 'спина', 'ноги', 'плечі', 'руки', 'прес', 'кардіо', 'все тіло'];

interface Props {
  match: MatchListItem;
  onBack: () => void;
  onDone: () => void;
}

export function WorkoutFormScreen({ match, onBack, onDone }: Props) {
  const { token } = useAuth();
  const api = authApi(token!);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]!);
  const [type, setType] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!type.trim()) { setError('Обери тип тренування'); return; }
    setBusy(true);
    setError(null);
    try {
      await api.addWorkout(match.id, {
        date,
        type: (type.trim() || ''),
        sets: sets ? parseInt(sets, 10) : undefined,
        reps: reps ? parseInt(reps, 10) : undefined,
        weightKg: weight ? parseFloat(weight) : undefined,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося зберегти');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <div className="mb-2">
        <button type="button" onClick={onBack} className="text-accent text-[16px]">← Назад</button>
      </div>
      <Title style={{ marginTop: 8, marginBottom: 16 }}>Додати тренування</Title>

      <p className="text-muted text-[12px] font-semibold uppercase tracking-wide mb-2">Дата</p>
      <input
        type="date"
        className="w-full bg-card rounded-[10px] p-3 text-text text-[16px] border border-border mb-4"
        value={date}
        max={new Date().toISOString().split('T')[0]!}
        onChange={(e) => setDate(e.target.value)}
      />

      <p className="text-muted text-[12px] font-semibold uppercase tracking-wide mb-2">Тип</p>
      <div className="flex flex-row flex-wrap gap-2 mb-4">
        {WORKOUT_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(type === t ? '' : t)}
            className={`px-4 py-2 rounded-full text-[14px] border transition-colors ${
              type === t
                ? 'bg-accent border-accent text-white'
                : 'bg-card border-border text-muted'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex flex-row gap-3 mb-4">
        {[
          { label: 'Підходи', value: sets, onChange: setSets, placeholder: '3' },
          { label: 'Повторення', value: reps, onChange: setReps, placeholder: '10' },
          { label: 'Вага (кг)', value: weight, onChange: setWeight, placeholder: '60' },
        ].map(({ label, value, onChange, placeholder }) => (
          <div key={label} className="flex-1">
            <p className="text-muted text-[12px] font-semibold uppercase tracking-wide mb-1">{label}</p>
            <input
              type="number"
              className="w-full bg-card rounded-[10px] p-3 text-text text-[16px] text-center border border-border"
              placeholder={placeholder}
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
          </div>
        ))}
      </div>

      {error && <p className="text-error my-3">{error}</p>}
      <Button title={busy ? 'Зберігаємо…' : 'Додати'} onClick={() => void submit()} disabled={busy} />
    </Screen>
  );
}
