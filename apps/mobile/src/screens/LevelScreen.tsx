import React from 'react';
import { StyleSheet, Text } from 'react-native';
import type { Level } from '../api';
import { useOnboarding } from '../onboarding/store';
import { Card, Screen, Subtitle, Title } from '../ui';

const LEVELS: Array<{ value: Level; emoji: string; label: string; hint: string }> = [
  { value: 'BEGINNER', emoji: '🌱', label: 'Новачок', hint: 'Тренуюся менше року' },
  { value: 'INTERMEDIATE', emoji: '⚡', label: 'Середній', hint: '1–3 роки регулярних тренувань' },
  { value: 'ADVANCED', emoji: '🏆', label: 'Досвідчений', hint: '3+ роки, можу підстрахувати' },
];

export function LevelScreen() {
  const { setLevel } = useOnboarding();
  return (
    <Screen>
      <Title>Твій рівень?</Title>
      <Subtitle>Щоб партнер був приблизно на одній хвилі</Subtitle>
      {LEVELS.map((l) => (
        <Card key={l.value} onPress={() => setLevel(l.value)}>
          <Text style={s.label}>
            {l.emoji} {l.label}
          </Text>
          <Text style={s.hint}>{l.hint}</Text>
        </Card>
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  label: { color: '#e8ecf4', fontSize: 17, fontWeight: '600' },
  hint: { color: '#8b93a7', fontSize: 13, marginTop: 4 },
});
