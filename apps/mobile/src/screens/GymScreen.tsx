import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, type Gym } from '../api';
import { useOnboarding } from '../onboarding/store';
import { Button, Card, Loading, Screen, Subtitle, Title } from '../ui';

type Phase = 'ask' | 'loading' | 'list';

/**
 * Gym picker: geo first ("Визначити найближчий зал"), manual list as the
 * always-available fallback — geo permission denial never blocks onboarding.
 */
export function GymScreen() {
  const { setGym } = useOnboarding();
  const [phase, setPhase] = useState<Phase>('ask');
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load(coords?: { lat: number; lng: number }) {
    setPhase('loading');
    setError(null);
    try {
      setGyms(await api.gyms(coords));
      setPhase('list');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вдалося завантажити зали');
      setPhase('ask');
    }
  }

  async function useLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        await load(); // denied → manual picker with all gyms
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await load({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      await load(); // any geo failure → manual picker
    }
  }

  if (phase === 'loading') {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Де тренуєшся?</Title>
      <Subtitle>Покажемо партнерів саме з твого залу</Subtitle>

      {phase === 'ask' && (
        <View>
          <Button title="📍 Визначити найближчий зал" onPress={() => void useLocation()} />
          <Button title="Обрати зал зі списку" kind="ghost" onPress={() => void load()} />
          {error && <Text style={s.error}>{error}</Text>}
        </View>
      )}

      {phase === 'list' && (
        <View>
          {gyms.map((g) => (
            <Card key={g.id} onPress={() => setGym({ id: g.id, name: g.name })}>
              <Text style={s.gym}>{g.name}</Text>
              <Text style={s.meta}>
                {g.city ?? ''}
                {typeof g.distanceKm === 'number' ? ` · ${g.distanceKm} км від тебе` : ''}
              </Text>
            </Card>
          ))}
          <Button title="Пропустити (покажу зал пізніше)" kind="ghost" onPress={() => setGym(null)} />
        </View>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  gym: { color: '#e8ecf4', fontSize: 17, fontWeight: '600' },
  meta: { color: '#8b93a7', fontSize: 13, marginTop: 4 },
  error: { color: '#e5534b', marginTop: 12 },
});
