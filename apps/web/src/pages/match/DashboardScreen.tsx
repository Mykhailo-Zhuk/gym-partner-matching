import { useCallback, useEffect, useState } from 'react';
import type { DashboardData, MatchListItem } from '../../api';
import { authApi } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Card, Loading, Screen, Title } from '../../components/ui/Screen';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

const METRIC_LABEL: Record<string, string> = { WORKOUT_COUNT: 'тренувань', TOTAL_KG: 'кг' };

interface Props {
  match: MatchListItem;
  onBack: () => void;
  onAddWorkout: (match: MatchListItem) => void;
  onCreateGoal: (match: MatchListItem) => void;
  onRate: (match: MatchListItem) => void;
}

export function DashboardScreen({ match, onBack, onAddWorkout, onCreateGoal, onRate }: Props) {
  const { token } = useAuth();
  const api = authApi(token!);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.getDashboard(match.id);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося завантажити');
    } finally {
      setLoading(false);
    }
  }, [api, match.id]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <Screen><Loading /></Screen>;

  const pendingGoals = data?.goals.filter((g) => g.status === 'PENDING_CONFIRM') ?? [];
  const activeGoals = data?.goals.filter((g) => g.status === 'ACTIVE') ?? [];
  const doneGoals = data?.goals.filter((g) => g.status === 'DONE') ?? [];

  return (
    <Screen>
      {/* Header */}
      <div className="mb-4">
        <button type="button" onClick={onBack} className="text-accent text-[16px]">← Назад</button>
        <Title style={{ marginTop: 8 }}>Дашборд</Title>
        <p className="text-muted text-[15px]">з {match.partner.name}</p>
      </div>

      {error && <p className="text-error mb-3">{error}</p>}

      {/* Stats */}
      {data && (
        <div className="flex flex-row gap-3 mb-5">
          {[
            { num: data.stats.workoutCount, label: 'тренувань' },
            { num: data.stats.totalKg.toLocaleString('uk-UA'), label: 'кг піднято' },
            { num: data.stats.streakWeeks, label: 'тижнів' },
          ].map(({ num, label }) => (
            <Card key={label} style={{ flex: 1, textAlign: 'center', paddingBlock: 16 }}>
              <p className="text-text text-[28px] font-bold">{num}</p>
              <p className="text-muted text-[12px] mt-0.5">{label}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Pending confirmations */}
      {pendingGoals.length > 0 && (
        <>
          <p className="text-muted text-[12px] font-semibold uppercase mb-2">Очікує підтвердження</p>
          {pendingGoals.map((g) => (
            <Card key={g.id} style={{ marginBottom: 12 }}>
              <p className="text-text text-[16px] font-semibold mb-1">{g.title}</p>
              <p className="text-muted text-[13px] mb-3">{g.progress}/{g.target} {METRIC_LABEL[g.metric]}</p>
              <Button
                title="Підтвердити ціль"
                onClick={() => void api.confirmGoal(match.id, g.id).then(() => load())}
              />
            </Card>
          ))}
        </>
      )}

      {/* Active goals */}
      {activeGoals.length > 0 && (
        <>
          <p className="text-muted text-[12px] font-semibold uppercase mt-4 mb-2">Активні цілі</p>
          {activeGoals.map((g) => (
            <Card key={g.id} style={{ marginBottom: 12 }}>
              <p className="text-text text-[16px] font-semibold mb-2">{g.title}</p>
              <div className="h-2 bg-bg rounded overflow-hidden mb-2">
                <div
                  className="h-2 bg-accent rounded"
                  style={{ width: `${Math.min(100, (g.progress / g.target) * 100)}%` }}
                />
              </div>
              <p className="text-muted text-[13px]">
                {g.progress}/{g.target} {METRIC_LABEL[g.metric]} ({Math.round((g.progress / g.target) * 100)}%)
              </p>
              {g.due && <p className="text-muted text-[12px] mt-1">До {fmtDate(g.due)}</p>}
            </Card>
          ))}
        </>
      )}

      {/* Done goals */}
      {doneGoals.length > 0 && (
        <>
          <p className="text-muted text-[12px] font-semibold uppercase mt-4 mb-2">Виконані</p>
          {doneGoals.map((g) => (
            <Card key={g.id} style={{ marginBottom: 12 }}>
              <p className="text-accent text-[16px] font-semibold mb-1">✅ {g.title}</p>
              <p className="text-muted text-[13px]">{g.target} {METRIC_LABEL[g.metric]}</p>
            </Card>
          ))}
        </>
      )}

      {/* Workout history */}
      {data && data.workouts.length > 0 && (
        <>
          <p className="text-muted text-[12px] font-semibold uppercase mt-4 mb-2">Історія</p>
          {data.workouts.map((w) => (
            <Card key={w.id} style={{ marginBottom: 10 }}>
              <div className="flex flex-row justify-between items-center">
                <div>
                  <p className="text-text text-[15px] font-semibold">{w.type}</p>
                  <p className="text-muted text-[12px] mt-0.5">{fmtDate(w.date)} · {w.user.name}</p>
                </div>
                <div>
                  <p className="text-text text-[14px] font-semibold">
                    {w.sets && w.reps && w.weightKg ? `${w.sets}×${w.reps} @ ${w.weightKg}кг` : '—'}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </>
      )}

      <div className="mt-6 space-y-3 mb-10">
        <Button title="+ Додати тренування" onClick={() => onAddWorkout(match)} />
        <Button title="Створити ціль" kind="ghost" onClick={() => onCreateGoal(match)} />
        {match.status === 'ACTIVE' && (
          <Button title="Завершити матч" kind="ghost" onClick={() => onRate(match)} />
        )}
      </div>
    </Screen>
  );
}
