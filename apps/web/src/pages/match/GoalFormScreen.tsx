import { useState } from 'react';
import type { GoalMetric, MatchListItem } from '../../api';
import { authApi } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Card, Screen, Title } from '../../components/ui/Screen';

interface Props {
  match: MatchListItem;
  onBack: () => void;
  onDone: () => void;
}

export function GoalFormScreen({ match, onBack, onDone }: Props) {
  const { token } = useAuth();
  const api = authApi(token!);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [metric, setMetric] = useState<GoalMetric>('WORKOUT_COUNT');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!title.trim() || !target) { setError('Заповни всі поля'); return; }
    setBusy(true);
    setError(null);
    try {
      await api.createGoal(match.id, {
        title: title.trim(),
        target: parseInt(target, 10),
        metric,
        due: due || undefined,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося створити');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <div className="mb-2">
        <button type="button" onClick={onBack} className="text-accent text-[16px]">← Назад</button>
      </div>
      <Title style={{ marginTop: 8, marginBottom: 16 }}>Нова ціль</Title>

      <p className="text-muted text-[12px] font-semibold uppercase tracking-wide mb-2">Назва</p>
      <input
        className="w-full bg-card rounded-[10px] p-3 text-text text-[16px] border border-border mb-4"
        placeholder="10 тренувань за місяць"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <p className="text-muted text-[12px] font-semibold uppercase tracking-wide mb-2">Метрика</p>
      <div className="flex flex-row gap-3 mb-4">
        <Card
          onPress={() => setMetric('WORKOUT_COUNT')}
          style={{ flex: 1, textAlign: 'center', paddingBlock: 14, ...(metric === 'WORKOUT_COUNT' ? { borderColor: '#4f8cff', borderWidth: 1 } : {}) }}
        >
          <p className="text-[24px] mb-1">🏋️</p>
          <p className={`text-[12px] text-center ${metric === 'WORKOUT_COUNT' ? 'text-accent font-semibold' : 'text-muted'}`}>
            Кількість тренувань
          </p>
        </Card>
        <Card
          onPress={() => setMetric('TOTAL_KG')}
          style={{ flex: 1, textAlign: 'center', paddingBlock: 14, ...(metric === 'TOTAL_KG' ? { borderColor: '#4f8cff', borderWidth: 1 } : {}) }}
        >
          <p className="text-[24px] mb-1">⚡</p>
          <p className={`text-[12px] text-center ${metric === 'TOTAL_KG' ? 'text-accent font-semibold' : 'text-muted'}`}>
            Загальна вага (кг)
          </p>
        </Card>
      </div>

      <p className="text-muted text-[12px] font-semibold uppercase tracking-wide mb-2">Ціль</p>
      <input
        type="number"
        className="w-full bg-card rounded-[10px] p-3 text-text text-[16px] border border-border mb-4"
        placeholder={metric === 'WORKOUT_COUNT' ? '10' : '5000'}
        value={target}
        onChange={(e) => setTarget(e.target.value)}
      />

      <p className="text-muted text-[12px] font-semibold uppercase tracking-wide mb-2">Дедлайн (необовʼязково)</p>
      <input
        type="date"
        className="w-full bg-card rounded-[10px] p-3 text-text text-[16px] border border-border mb-4"
        value={due}
        min={new Date().toISOString().split('T')[0]}
        onChange={(e) => setDue(e.target.value)}
      />

      {error && <p className="text-error my-3">{error}</p>}
      <Button title={busy ? 'Створюємо…' : 'Створити ціль'} onClick={() => void submit()} disabled={busy} />
    </Screen>
  );
}
