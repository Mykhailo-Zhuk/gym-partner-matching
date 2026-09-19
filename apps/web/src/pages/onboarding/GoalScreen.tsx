import type { Goal } from '../../types';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { Card, Screen, Subtitle, Title } from '../../components/ui/Screen';

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
          <p className="text-text text-[17px] font-semibold">
            {g.emoji} {g.label}
          </p>
          <p className="text-muted text-[13px] mt-1">{g.hint}</p>
        </Card>
      ))}
    </Screen>
  );
}
