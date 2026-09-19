import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { UserProfile } from '../api';
import { Card, Screen, Title } from '../ui';

const GOAL_LABEL: Record<string, string> = {
  MASS: 'Набір маси', CUT: 'Сушка', STRENGTH: 'Сила',
  ENDURANCE: 'Витривалість', GENERAL: 'Загальна форма',
};
const LEVEL_LABEL: Record<string, string> = {
  BEGINNER: 'Новачок', INTERMEDIATE: 'Середній', ADVANCED: 'Досвідчений',
};

/** Read-only preview of own profile as others see it (story #8). */
export function ProfilePreviewScreen({ profile }: { profile: UserProfile }) {
  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Title style={{ marginBottom: 6 }}>Подивитись як виглядає</Title>
        <Text style={s.hint}>Саме це бачать інші користувачі у картках пошуку</Text>

        <Card style={{ marginTop: 20 }}>
          <View style={s.header}>
            <View style={s.avatar}>
              {profile.photoUrl ? (
                <Image source={{ uri: profile.photoUrl }} style={s.avatarImg} />
              ) : (
                <Text style={s.initial}>{profile.name[0]}</Text>
              )}
            </View>
            <View style={s.headerInfo}>
              <Text style={s.name}>{profile.name}</Text>
              <Text style={s.meta}>
                {profile.level ? LEVEL_LABEL[profile.level] : '—'} · {profile.goal ? GOAL_LABEL[profile.goal] : '—'}
              </Text>
              {profile.gym && <Text style={s.gym}>🏋️ {profile.gym.name}</Text>}
            </View>
          </View>

          {profile.schedule && (
            <Text style={s.schedule}>🕒 {profile.schedule}</Text>
          )}

          {profile.bio && (
            <Text style={s.bio}>"{profile.bio}"</Text>
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  hint: { color: '#8b93a7', fontSize: 14 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#2a3554',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  avatarImg: { width: 64, height: 64, borderRadius: 32 },
  initial: { color: '#e8ecf4', fontSize: 26, fontWeight: '700' },
  headerInfo: { flex: 1 },
  name: { color: '#e8ecf4', fontSize: 20, fontWeight: '700' },
  meta: { color: '#4f8cff', fontSize: 14, marginTop: 2 },
  gym: { color: '#8b93a7', fontSize: 13, marginTop: 4 },
  schedule: { color: '#8b93a7', fontSize: 14, marginBottom: 10 },
  bio: { color: '#8b93a7', fontSize: 15, fontStyle: 'italic', lineHeight: 22 },
});
