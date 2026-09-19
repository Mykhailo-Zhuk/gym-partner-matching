import React from 'react';
import { Text } from 'react-native';
import { StyleSheet } from 'react-native';
import type { Goal } from '../api';
import { useOnboarding } from '../onboarding/store';
import { Card, Screen, Subtitle, Title } from '../ui';

const GOALS: Array<{ value: Goal; emoji: string; label: string; hint: string }> = [
  { value: 'MASS', emoji: '🍗', label: 'Набір маси', hint: 'Прогресія ваг, калорійний профіцит' },
  { value: 'CUT', emoji: '🔥', label: 'Сушка', hint: 'Дефіцит калорій, збереження мʼязів' },
  { value: 'STRENGTH', emoji: '🏋️', label: 'Сила', hint: 'Базові рухи, робочі підходи' },
  { value: 'ENDURANCE', emoji: '🏃', label: 'Витривалість', hint: 'Кардіо, крос-фіт, функціоналка' },
  { value: 'GENERAL', emoji: '💪', label: 'Загальна форма', hint: 'Просто тренуюся для себе' },
];

export function GoalScreen() {
  const { setGoal } = useOnboarding();
  return (
    <Screen>
      <Title>Твоя ціль?</Title>
      <Subtitle>Підберемо партнерів, які йдуть тим самим шляхом</Subtitle>
      {GOALS.map((g) => (
        <Card key={g.value} onPress={() => setGoal(g.value)}>
          <Text style={s.label}>
            {g.emoji} {g.label}
          </Text>
          <Text style={s.hint}>{g.hint}</Text>
        </Card>
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  label: { color: '#e8ecf4', fontSize: 17, fontWeight: '600' },
  hint: { color: '#8b93a7', fontSize: 13, marginTop: 4 },
});
