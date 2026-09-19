import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, type PreviewCard } from '../api';
import { useOnboarding } from '../onboarding/store';
import { Button, Card, Loading, Screen, Subtitle } from '../ui';

const GOAL_LABEL: Record<string, string> = {
  MASS: 'Набір маси',
  CUT: 'Сушка',
  STRENGTH: 'Сила',
  ENDURANCE: 'Витривалість',
  GENERAL: 'Загальна форма',
};
const LEVEL_LABEL: Record<string, string> = { BEGINNER: 'Новачок', INTERMEDIATE: 'Середній', ADVANCED: 'Досвідчений' };

/**
 * Value-before-registration screen (story #6): shows 3-5 anonymized partner
 * cards fetched pre-auth. No names/photos/emails — those unlock after signup.
 * Ends in the registration wall CTA.
 */
export function PreviewScreen() {
  const { state, goTo } = useOnboarding();
  const [cards, setCards] = useState<PreviewCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .preview({ goal: state.goal, level: state.level, gymId: state.gym?.id })
      .then((res) => setCards(res.cards))
      .catch((err) => setError(err instanceof Error ? err.message : 'Помилка завантаження'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={s.heading}>Ось хто вже чекає на партнера 💪</Text>
        <Subtitle>
          {state.gym ? `Зал: ${state.gym.name}` : 'Поруч із тобою'}
          {state.goal ? ` · ${GOAL_LABEL[state.goal]}` : ''}
        </Subtitle>

        {!cards && !error && <Loading />}
        {error && <Text style={s.error}>{error}</Text>}

        {cards?.map((c, i) => (
          <Card key={i}>
            <View style={s.cardRow}>
              <Text style={s.name}>{c.firstName}</Text>
              <Text style={s.badge}>{LEVEL_LABEL[c.level] ?? c.level}</Text>
            </View>
            <Text style={s.meta}>
              {GOAL_LABEL[c.goal] ?? c.goal}
              {c.gymName ? ` · ${c.gymName}` : ''}
            </Text>
            {c.schedule ? <Text style={s.schedule}>🕒 {c.schedule}</Text> : null}
          </Card>
        ))}

        <View style={s.wall}>
          <Text style={s.wallText}>Імена, фото та чат — після реєстрації</Text>
          <Button title="Зареєструватися, щоб писати партнерам" onPress={() => goTo('register')} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  heading: { color: '#e8ecf4', fontSize: 26, fontWeight: '700', marginBottom: 6 },
  error: { color: '#e5534b', marginTop: 12 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: '#e8ecf4', fontSize: 18, fontWeight: '700' },
  badge: { color: '#4f8cff', fontSize: 12, fontWeight: '600' },
  meta: { color: '#8b93a7', fontSize: 13, marginTop: 4 },
  schedule: { color: '#8b93a7', fontSize: 13, marginTop: 2 },
  wall: { marginTop: 20, marginBottom: 40 },
  wallText: { color: '#8b93a7', textAlign: 'center', marginBottom: 4 },
});
