import type { UserProfile } from '../../api';
import { Card, Screen, Title } from '../../components/ui/Screen';

const GOAL_LABEL: Record<string, string> = {
  MASS: 'Набір маси', CUT: 'Сушка', STRENGTH: 'Сила',
  ENDURANCE: 'Витривалість', GENERAL: 'Загальна форма',
};
const LEVEL_LABEL: Record<string, string> = {
  BEGINNER: 'Новачок', INTERMEDIATE: 'Середній', ADVANCED: 'Досвідчений',
};

interface Props {
  profile: UserProfile;
}

export function ProfilePreviewScreen({ profile }: Props) {
  return (
    <Screen>
      <Title style={{ marginBottom: 6 }}>Подивитись як виглядає</Title>
      <p className="text-muted text-[14px] mb-6">Саме це бачать інші користувачі у картках пошуку</p>

      <Card>
        <div className="flex flex-row items-center mb-4">
          <div className="w-[64px] h-[64px] rounded-full bg-border flex items-center justify-center shrink-0 mr-4 overflow-hidden">
            {profile.photoUrl ? (
              <img src={profile.photoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-text text-[26px] font-bold">{profile.name[0]}</span>
            )}
          </div>
          <div>
            <p className="text-text text-[20px] font-bold">{profile.name}</p>
            <p className="text-accent text-[14px] mt-0.5">
              {profile.level ? LEVEL_LABEL[profile.level] : '—'} · {profile.goal ? GOAL_LABEL[profile.goal] : '—'}
            </p>
            {profile.gym && <p className="text-muted text-[13px] mt-1">🏋️ {profile.gym.name}</p>}
          </div>
        </div>

        {profile.schedule && (
          <p className="text-muted text-[14px] mb-3">🕒 {profile.schedule}</p>
        )}
        {profile.bio && (
          <p className="text-muted text-[15px] italic leading-6">"{profile.bio}"</p>
        )}
      </Card>
    </Screen>
  );
}
