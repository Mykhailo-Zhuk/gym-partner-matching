import React, { useCallback, useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { UserProfile } from '../api';
import { authApi } from '../api';
import { useAuth } from '../auth';
import { Button, Card, Loading, Screen, Title } from '../ui';

const GOAL_LABEL: Record<string, string> = {
  MASS: 'Набір маси', CUT: 'Сушка', STRENGTH: 'Сила',
  ENDURANCE: 'Витривалість', GENERAL: 'Загальна форма',
};
const LEVEL_LABEL: Record<string, string> = {
  BEGINNER: 'Новачок', INTERMEDIATE: 'Середній', ADVANCED: 'Досвідчений',
};

export function ProfileScreen({ onEdit, onPreview }: { onEdit: () => void; onPreview: () => void }) {
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
  if (error) return <Screen><Text style={s.error}>{error}</Text></Screen>;
  if (!profile) return null;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Title style={{ marginBottom: 20 }}>Мій профіль</Title>

        <View style={s.avatarWrap}>
          {profile.photoUrl ? (
            <Image source={{ uri: profile.photoUrl }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, s.avatarFallback]}>
              <Text style={s.avatarInitial}>{profile.name[0]}</Text>
            </View>
          )}
        </View>

        <Text style={s.name}>{profile.name}</Text>
        <Text style={s.email}>{profile.email}</Text>

        <Card style={{ marginTop: 20 }}>
          <Text style={s.section}>Ціль</Text>
          <Text style={s.value}>{profile.goal ? GOAL_LABEL[profile.goal] : 'Не вказано'}</Text>

          <Text style={s.section}>Рівень</Text>
          <Text style={s.value}>{profile.level ? LEVEL_LABEL[profile.level] : 'Не вказано'}</Text>

          <Text style={s.section}>Час тренувань</Text>
          <Text style={s.value}>{profile.schedule ?? 'Не вказано'}</Text>

          <Text style={s.section}>Зал</Text>
          <Text style={s.value}>{profile.gym?.name ?? 'Не вказано'}</Text>

          <Text style={s.section}>Про мене</Text>
          <Text style={s.value}>{profile.bio ?? 'Не вказано'}</Text>
        </Card>

        <Button title="Редагувати профіль" onPress={onEdit} />
        <Button title="Подивитись як бачать інші" kind="ghost" onPress={onPreview} />
        <Button
          title="Вийти"
          kind="ghost"
          onPress={() => setToken(null)}
        />
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  avatarWrap: { alignItems: 'center', marginBottom: 12 },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarFallback: { backgroundColor: '#2a3554', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#e8ecf4', fontSize: 36, fontWeight: '700' },
  name: { color: '#e8ecf4', fontSize: 24, fontWeight: '700', textAlign: 'center' },
  email: { color: '#8b93a7', fontSize: 14, textAlign: 'center', marginTop: 4 },
  section: { color: '#8b93a7', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginTop: 14, marginBottom: 4 },
  value: { color: '#e8ecf4', fontSize: 16 },
  error: { color: '#e5534b' },
});
