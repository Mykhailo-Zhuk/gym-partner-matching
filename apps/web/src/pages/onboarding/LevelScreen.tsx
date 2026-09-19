import type { Level } from '../../types';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { Card, Screen, Subtitle, Title } from '../../components/ui/Screen';

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
          <p className="text-text text-[17px] font-semibold">
            {l.emoji} {l.label}
          </p>
          <p className="text-muted text-[13px] mt-1">{l.hint}</p>
        </Card>
      ))}
    </Screen>
  );
}
