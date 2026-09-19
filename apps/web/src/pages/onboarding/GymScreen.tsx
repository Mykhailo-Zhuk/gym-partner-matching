import { useState } from 'react';
import { api, type Gym } from '../../api';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useGeolocation } from '../../hooks/useGeolocation';
import { Button, Card, Loading, Screen, Subtitle, Title } from '../../components/ui/Screen';

type Phase = 'ask' | 'loading' | 'list';

export function GymScreen() {
  const { setGym } = useOnboarding();
  const { location, error: geoError, loading: geoLoading, request } = useGeolocation();
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [phase, setPhase] = useState<Phase>('ask');
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

  function handleGeo() {
    request();
  }

  // When location is available, load gyms with coords
  if (location && phase === 'ask') {
    void load(location);
  }

  if (phase === 'loading' || geoLoading) {
    return <Screen><Loading /></Screen>;
  }

  return (
    <Screen>
      <Title>Де тренуєшся?</Title>
      <Subtitle>Покажемо партнерів саме з твого залу</Subtitle>

      {phase === 'ask' && (
        <div>
          <Button
            title="📍 Визначити найближчий зал"
            onClick={handleGeo}
            disabled={geoLoading}
          />
          <Button
            title="Обрати зал зі списку"
            kind="ghost"
            onClick={() => void load()}
          />
          {(error || geoError) && (
            <p className="text-error mt-3">{error ?? geoError}</p>
          )}
        </div>
      )}

      {phase === 'list' && (
        <div>
          {gyms.map((g) => (
            <Card key={g.id} onPress={() => setGym({ id: g.id, name: g.name })}>
              <p className="text-text text-[17px] font-semibold">{g.name}</p>
              <p className="text-muted text-[13px] mt-1">
                {g.city ?? ''}
                {typeof g.distanceKm === 'number' ? ` · ${g.distanceKm} км від тебе` : ''}
              </p>
            </Card>
          ))}
          <Button
            title="Пропустити (покажу зал пізніше)"
            kind="ghost"
            onClick={() => setGym(null)}
          />
        </div>
      )}
    </Screen>
  );
}
