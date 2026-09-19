import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Goal, Level } from '../api';
import { Button, Card, Screen, Title } from '../ui';

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

export function FilterScreen({
  initial,
  onSearch,
}: {
  initial?: { goal?: Goal; level?: Level; schedule?: string; gymId?: string };
  onSearch: (filters: { goal?: Goal; level?: Level; schedule?: string; gymId?: string }) => void;
}) {
  const [goal, setGoal] = useState<Goal | undefined>(initial?.goal);
  const [level, setLevel] = useState<Level | undefined>(initial?.level);
  const [schedule, setSchedule] = useState(initial?.schedule ?? '');
  const [gymId, setGymId] = useState(initial?.gymId);

  function submit() {
    onSearch({
      goal,
      level,
      schedule: schedule || undefined,
      gymId,
    });
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Title>Знайти партнера</Title>

        <Text style={s.section}>Ціль</Text>
        <View style={s.row}>
          {GOALS.map((g) => (
            <Card
              key={g.value}
              onPress={() => setGoal(goal === g.value ? undefined : g.value)}
              style={{ flex: 1, marginRight: 8, marginBottom: 8, padding: 10 }}
            >
              <Text style={s.emoji}>{g.emoji}</Text>
              <Text style={[s.chipLabel, goal === g.value && s.chipActive]}>{g.label}</Text>
            </Card>
          ))}
        </View>

        <Text style={s.section}>Рівень</Text>
        <View style={s.row}>
          {LEVELS.map((l) => (
            <Card
              key={l.value}
              onPress={() => setLevel(level === l.value ? undefined : l.value)}
              style={{ flex: 1, marginRight: 8, marginBottom: 8, padding: 10 }}
            >
              <Text style={s.emoji}>{l.emoji}</Text>
              <Text style={[s.chipLabel, level === l.value && s.chipActive]}>{l.label}</Text>
            </Card>
          ))}
        </View>

        <Text style={s.section}>Час тренувань</Text>
        <Card style={{ marginBottom: 12 }}>
          <View style={s.scheduleRow}>
            <Text style={s.scheduleHint}>вечір після 18:00</Text>
          </View>
          <View style={s.textInputWrapper}>
            <Text style={s.textInputLabel}>Вільний час</Text>
            <View style={s.textInput}>
              <Text style={{ color: '#e8ecf4', fontSize: 16 }}>{schedule || '—'}</Text>
            </View>
          </View>
        </Card>

        <Button title="Шукати" onPress={submit} />
        <Button
          title="Скинути фільтри"
          kind="ghost"
          onPress={() => { setGoal(undefined); setLevel(undefined); setSchedule(''); setGymId(undefined); }}
        />
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  section: { color: '#8b93a7', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginTop: 16, marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  emoji: { fontSize: 20, textAlign: 'center' },
  chipLabel: { color: '#8b93a7', fontSize: 12, textAlign: 'center', marginTop: 4 },
  chipActive: { color: '#4f8cff' },
  scheduleRow: { flexDirection: 'row', justifyContent: 'space-between' },
  scheduleHint: { color: '#8b93a7', fontSize: 12 },
  textInputWrapper: { marginTop: 8 },
  textInputLabel: { color: '#8b93a7', fontSize: 13, marginBottom: 4 },
  textInput: { backgroundColor: '#0f1420', borderRadius: 8, padding: 12 },
});
