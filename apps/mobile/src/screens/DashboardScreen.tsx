import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DashboardData, GoalWithProgress, MatchListItem, Workout } from '../api';
import { authApi } from '../api';
import { useAuth } from '../auth';
import { Button, Card, Loading, Screen, Title } from '../ui';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

const METRIC_LABEL: Record<string, string> = { WORKOUT_COUNT: 'тренувань', TOTAL_KG: 'кг' };
const STATUS_LABEL: Record<string, string> = {
  PENDING_CONFIRM: 'Очікує підтвердження',
  ACTIVE: 'Активна',
  DONE: 'Виконано! 🎉',
};

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
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={onBack}><Text style={s.back}>← Назад</Text></Pressable>
          <Title style={{ marginTop: 8 }}>Дашборд</Title>
          <Text style={s.sub}>з {match.partner.name}</Text>
        </View>

        {error && <Text style={s.error}>{error}</Text>}

        {/* Stats */}
        {data && (
          <View style={s.stats}>
            <Card style={s.statCard}>
              <Text style={s.statNum}>{data.stats.workoutCount}</Text>
              <Text style={s.statLabel}>тренувань</Text>
            </Card>
            <Card style={s.statCard}>
              <Text style={s.statNum}>{data.stats.totalKg.toLocaleString('uk-UA')}</Text>
              <Text style={s.statLabel}>кг піднято</Text>
            </Card>
            <Card style={s.statCard}>
              <Text style={s.statNum}>{data.stats.streakWeeks}</Text>
              <Text style={s.statLabel}>тижнів</Text>
            </Card>
          </View>
        )}

        {/* Pending goal confirmations */}
        {pendingGoals.length > 0 && (
          <>
            <Text style={s.section}>Очікує підтвердження</Text>
            {pendingGoals.map((g) => (
              <Card key={g.id}>
                <Text style={s.goalTitle}>{g.title}</Text>
                <Text style={s.goalMeta}>{g.progress}/{g.target} {METRIC_LABEL[g.metric]}</Text>
                <Button title="Підтвердити ціль" onPress={() => void api.confirmGoal(match.id, g.id).then(() => load())} />
              </Card>
            ))}
          </>
        )}

        {/* Active goals */}
        {activeGoals.length > 0 && (
          <>
            <Text style={s.section}>Активні цілі</Text>
            {activeGoals.map((g) => (
              <Card key={g.id}>
                <Text style={s.goalTitle}>{g.title}</Text>
                <View style={s.progressBar}>
                  <View style={[s.progressFill, { width: `${Math.min(100, (g.progress / g.target) * 100)}%` }]} />
                </View>
                <Text style={s.goalMeta}>{g.progress}/{g.target} {METRIC_LABEL[g.metric]} ({Math.round((g.progress / g.target) * 100)}%)</Text>
                {g.due && <Text style={s.goalDue}>До {fmtDate(g.due)}</Text>}
              </Card>
            ))}
          </>
        )}

        {/* Done goals */}
        {doneGoals.length > 0 && (
          <>
            <Text style={s.section}>Виконані</Text>
            {doneGoals.map((g) => (
              <Card key={g.id}>
                <Text style={s.goalTitleDone}>✅ {g.title}</Text>
                <Text style={s.goalMeta}>{g.target} {METRIC_LABEL[g.metric]}</Text>
              </Card>
            ))}
          </>
        )}

        {/* Workout history */}
        {data && data.workouts.length > 0 && (
          <>
            <Text style={s.section}>Історія</Text>
            {data.workouts.map((w) => (
              <Card key={w.id}>
                <View style={s.workoutRow}>
                  <View>
                    <Text style={s.workoutType}>{w.type}</Text>
                    <Text style={s.workoutDate}>{fmtDate(w.date)} · {w.user.name}</Text>
                  </View>
                  <View style={s.workoutSets}>
                    {(w.sets && w.reps && w.weightKg) ? (
                      <Text style={s.workoutSetsText}>{w.sets}×{w.reps} @ {w.weightKg}кг</Text>
                    ) : (
                      <Text style={s.workoutSetsText}>—</Text>
                    )}
                  </View>
                </View>
              </Card>
            ))}
          </>
        )}

        <View style={s.actions}>
          <Button title="+ Додати тренування" onPress={() => onAddWorkout(match)} />
          <Button title="Створити ціль" kind="ghost" onPress={() => onCreateGoal(match)} />
          {match.status === 'ACTIVE' && (
            <Button title="Завершити матч" kind="ghost" onPress={() => onRate(match)} />
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { marginBottom: 16 },
  back: { color: '#4f8cff', fontSize: 16 },
  sub: { color: '#8b93a7', fontSize: 15 },
  stats: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statNum: { color: '#e8ecf4', fontSize: 28, fontWeight: '700' },
  statLabel: { color: '#8b93a7', fontSize: 12, marginTop: 2 },
  section: { color: '#8b93a7', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginTop: 16, marginBottom: 8 },
  goalTitle: { color: '#e8ecf4', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  goalTitleDone: { color: '#4f8cff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  goalMeta: { color: '#8b93a7', fontSize: 13, marginBottom: 8 },
  goalDue: { color: '#8b93a7', fontSize: 12 },
  progressBar: { height: 8, backgroundColor: '#0f1420', borderRadius: 4, marginBottom: 6, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: '#4f8cff', borderRadius: 4 },
  workoutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  workoutType: { color: '#e8ecf4', fontSize: 15, fontWeight: '600' },
  workoutDate: { color: '#8b93a7', fontSize: 12, marginTop: 2 },
  workoutSets: { alignItems: 'flex-end' },
  workoutSetsText: { color: '#e8ecf4', fontSize: 14, fontWeight: '600' },
  actions: { marginTop: 24, marginBottom: 40 },
  error: { color: '#e5534b', marginBottom: 12 },
});
