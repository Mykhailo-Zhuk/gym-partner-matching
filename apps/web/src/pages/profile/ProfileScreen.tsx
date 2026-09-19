import { useCallback, useEffect, useState } from 'react';
import type { UserProfile } from '../../api';
import { authApi } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Card, Loading, Screen, Title } from '../../components/ui/Screen';

const GOAL_LABEL: Record<string, string> = {
  MASS: 'Набір маси', CUT: 'Сушка', STRENGTH: 'Сила',
  ENDURANCE: 'Витривалість', GENERAL: 'Загальна форма',
};
const LEVEL_LABEL: Record<string, string> = {
  BEGINNER: 'Новачок', INTERMEDIATE: 'Середній', ADVANCED: 'Досвідчений',
};

interface Props {
  onEdit: (profile: UserProfile) => void;
  onPreview: (profile: UserProfile) => void;
}

export function ProfileScreen({ onEdit, onPreview }: Props) {
  const { token, setToken } = useAuth();
  const api = authApi(token!);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await api.getMe();
      setProfile(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося завантажити профіль');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <Screen><Loading /></Screen>;
  if (error) return <Screen><p className="text-error">{error}</p></Screen>;
  if (!profile) return null;

  return (
    <Screen>
      <Title style={{ marginBottom: 20 }}>Мій профіль</Title>

      <div className="flex flex-col items-center mb-4">
        <div className="w-[88px] h-[88px] rounded-full bg-border flex items-center justify-center overflow-hidden mb-3">
          {profile.photoUrl ? (
            <img src={profile.photoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-text text-[36px] font-bold">{profile.name[0]}</span>
          )}
        </div>
        <p className="text-text text-[24px] font-bold">{profile.name}</p>
        <p className="text-muted text-[14px] mt-1">{profile.email}</p>
      </div>

      <Card style={{ marginTop: 0, marginBottom: 16 }}>
        {[
          { label: 'Ціль', value: profile.goal ? GOAL_LABEL[profile.goal] : 'Не вказано' },
          { label: 'Рівень', value: profile.level ? LEVEL_LABEL[profile.level] : 'Не вказано' },
          { label: 'Час тренувань', value: profile.schedule ?? 'Не вказано' },
          { label: 'Зал', value: profile.gym?.name ?? 'Не вказано' },
          { label: 'Про мене', value: profile.bio ?? 'Не вказано' },
        ].map(({ label, value }) => (
          <div key={label} className="py-3 border-b border-card last:border-0">
            <p className="text-muted text-[12px] font-semibold uppercase tracking-wide mb-1">{label}</p>
            <p className="text-text text-[16px]">{value}</p>
          </div>
        ))}
      </Card>

      <div className="space-y-3">
        <Button title="Редагувати профіль" onClick={() => onEdit(profile)} />
        <Button title="Подивитись як бачать інші" kind="ghost" onClick={() => onPreview(profile)} />
        <Button title="Вийти" kind="ghost" onClick={() => setToken(null)} />
      </div>
    </Screen>
  );
}
