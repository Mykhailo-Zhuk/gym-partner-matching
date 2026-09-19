import { useEffect, useState } from 'react';
import { api, type PreviewCard } from '../../api';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { Button, Card, Loading, Screen, Subtitle } from '../../components/ui/Screen';

const GOAL_LABEL: Record<string, string> = {
  MASS: 'Набір маси', CUT: 'Сушка', STRENGTH: 'Сила',
  ENDURANCE: 'Витривалість', GENERAL: 'Загальна форма',
};
const LEVEL_LABEL: Record<string, string> = {
  BEGINNER: 'Новачок', INTERMEDIATE: 'Середній', ADVANCED: 'Досвідчений',
};

export function PreviewScreen() {
  const { state, goTo } = useOnboarding();
  const [cards, setCards] = useState<PreviewCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .preview({ goal: state.goal, level: state.level, gymId: state.gym?.id })
      .then((res) => setCards(res.cards))
      .catch((err) => setError(err instanceof Error ? err.message : 'Помилка завантаження'));
  }, [state.goal, state.level, state.gym]);

  return (
    <Screen>
      <h2 className="text-text text-[26px] font-bold mb-[6px]">Ось хто вже чекає на партнера 💪</h2>
      <Subtitle>
        {state.gym ? `Зал: ${state.gym.name}` : 'Поруч із тобою'}
        {state.goal ? ` · ${GOAL_LABEL[state.goal]}` : ''}
      </Subtitle>

      {!cards && !error && <Loading />}
      {error && <p className="text-error mt-3">{error}</p>}

      {cards?.map((c, i) => (
        <Card key={i}>
          <div className="flex flex-row justify-between items-center">
            <p className="text-text text-[18px] font-bold">{c.firstName}</p>
            <span className="text-accent text-[12px] font-semibold">
              {LEVEL_LABEL[c.level] ?? c.level}
            </span>
          </div>
          <p className="text-muted text-[13px] mt-1">
            {GOAL_LABEL[c.goal] ?? c.goal}
            {c.gymName ? ` · ${c.gymName}` : ''}
          </p>
          {c.schedule && <p className="text-muted text-[13px] mt-1">🕒 {c.schedule}</p>}
        </Card>
      ))}

      <div className="mt-5 mb-10">
        <p className="text-muted text-center mb-1">Імена, фото та чат — після реєстрації</p>
        <Button title="Зареєструватися, щоб писати партнерам" onClick={() => goTo('register')} />
      </div>
    </Screen>
  );
}
