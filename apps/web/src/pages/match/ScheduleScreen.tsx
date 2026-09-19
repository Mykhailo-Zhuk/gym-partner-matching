import { useState } from 'react';
import type { MatchListItem } from '../../api';
import { authApi } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Card, Screen, Title } from '../../components/ui/Screen';

interface Props {
  match: MatchListItem;
  onBack: () => void;
  onDone?: () => void;
}

export function ScheduleScreen({ match, onBack, onDone }: Props) {
  const { token } = useAuth();
  const api = authApi(token!);

  const defaultDate = match.scheduledAt
    ? new Date(match.scheduledAt)
    : new Date(Date.now() + 86400000);

  const [date, setDate] = useState(() => {
    const d = new Date(defaultDate);
    d.setHours(18, 0, 0, 0);
    return d;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.scheduleMatch(match.id, date.toISOString());
      onDone?.();
      onBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося зберегти');
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await api.scheduleMatch(match.id, null);
      onBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося скасувати');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <div className="mb-2">
        <button type="button" onClick={onBack} className="text-accent text-[16px]">
          ← Назад
        </button>
      </div>
      <Title style={{ marginTop: 8, marginBottom: 4 }}>Призначити тренування</Title>
      <p className="text-muted text-[15px] mb-6">з {match.partner.name}</p>

      <Card>
        <p className="text-muted text-[12px] font-semibold uppercase tracking-wide mb-2">Дата</p>
        <input
          type="date"
          className="w-full bg-bg rounded-[10px] p-3 text-text text-[16px] border border-border mb-4"
          value={date.toISOString().split('T')[0]}
          onChange={(e) => {
            const parts = e.target.value.split('-');
            const next = new Date(date);
            next.setFullYear(+parts[0]!, +parts[1]! - 1, +parts[2]!);
            setDate(next);
          }}
        />

        <p className="text-muted text-[12px] font-semibold uppercase tracking-wide mb-2">Час</p>
        <input
          type="time"
          className="w-full bg-bg rounded-[10px] p-3 text-text text-[16px] border border-border"
          value={`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`}
          onChange={(e) => {
            const parts = e.target.value.split(':');
            const next = new Date(date);
            next.setHours(+parts[0]!, +parts[1]!);
            setDate(next);
          }}
        />
      </Card>

      {error && <p className="text-error my-3">{error}</p>}

      <div className="mt-4 space-y-3">
        <Button title={busy ? 'Зберігаємо…' : 'Зберегти'} onClick={() => void save()} disabled={busy} />
        <Button title="Скасувати тренування" kind="ghost" onClick={() => void cancel()} disabled={busy} />
      </div>
    </Screen>
  );
}
