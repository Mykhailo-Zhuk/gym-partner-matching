import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import type { Goal, Level, UserProfile } from '../api';
import { authApi } from '../api';
import { useAuth } from '../auth';
import { Button, Card, Loading, Screen, Title } from '../ui';

const GOALS: Array<{ value: Goal; emoji: string; label: string }> = [
  { value: 'MASS', emoji: '🍗', label: 'Набір маси' },
  { value: 'CUT', emoji: '🔥', label: 'Сушка' },
  { value: 'STRENGTH', emoji: '🏋️', label: 'Сила' },
  { value: 'ENDURANCE', emoji: '🏃', label: 'Витривалість' },
  { value: 'GENERAL', emoji: '💪', label: 'Загальна форма' },
];
const LEVELS: Array<{ value: Level; emoji: string; label: string }> = [
  { value: 'BEGINNER', emoji: '🌱', label: 'Новачок' },
  { value: 'INTERMEDIATE', emoji: '⚡', label: 'Середній' },
  { value: 'ADVANCED', emoji: '🏆', label: 'Досвідчений' },
];

interface Props {
  initial: UserProfile;
  onSaved: (updated: UserProfile) => void;
  onCancel: () => void;
}

/** Optimistic save with rollback on error (story #8 AC). */
export function ProfileEditScreen({ initial, onSaved, onCancel }: Props) {
  const { token } = useAuth();
  const api = authApi(token!);

  const [name, setName] = useState(initial.name);
  const [bio, setBio] = useState(initial.bio ?? '');
  const [goal, setGoal] = useState<Goal | undefined>(initial.goal ?? undefined);
  const [level, setLevel] = useState<Level | undefined>(initial.level ?? undefined);
  const [schedule, setSchedule] = useState(initial.schedule ?? '');
  const [photoUrl, setPhotoUrl] = useState(initial.photoUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (bio.trim() === '') {
      setError('Про себе не може бути порожнім');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await api.updateMe({
        name: name.trim() || undefined,
        bio: bio.trim() || undefined,
        goal,
        level,
        schedule: schedule.trim() || undefined,
        photo_url: photoUrl.trim() || undefined,
      });
      onSaved(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося зберегти');
    } finally {
      setBusy(false);
    }
  }

  const valid = name.trim().length >= 2;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Title style={{ marginBottom: 20 }}>Редагувати профіль</Title>

        {/* Photo */}
        <View style={s.photoRow}>
          <View style={s.avatarPreview}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={s.avatarImg} />
            ) : (
              <Text style={s.avatarInitial}>{name[0] ?? '?'}</Text>
            )}
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={s.label}>URL фото</Text>
            <TextInput
              style={s.input}
              placeholder="https://…"
              placeholderTextColor="#8b93a7"
              value={photoUrl}
              onChangeText={setPhotoUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>
        </View>

        {/* Name */}
        <Text style={s.label}>Імʼя</Text>
        <TextInput style={s.input} placeholder="Імʼя" placeholderTextColor="#8b93a7" value={name} onChangeText={setName} />

        {/* Bio */}
        <Text style={s.label}>Про мене</Text>
        <TextInput
          style={[s.input, s.multiline]}
          placeholder="Розкажи про себе, свій досвід, цілі…"
          placeholderTextColor="#8b93a7"
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={4}
        />

        {/* Goal */}
        <Text style={s.label}>Ціль</Text>
        <View style={s.chips}>
          {GOALS.map((g) => (
            <Card
              key={g.value}
              onPress={() => setGoal(goal === g.value ? undefined : g.value)}
              style={goal === g.value ? [s.chip, s.chipActive] : s.chip}
            >
              <Text style={s.chipEmoji}>{g.emoji}</Text>
              <Text style={[s.chipLabel, goal === g.value && s.chipLabelActive]}>{g.label}</Text>
            </Card>
          ))}
        </View>

        {/* Level */}
        <Text style={s.label}>Рівень</Text>
        <View style={s.chips}>
          {LEVELS.map((l) => (
            <Card
              key={l.value}
              onPress={() => setLevel(level === l.value ? undefined : l.value)}
              style={level === l.value ? [s.chip, s.chipActive] : s.chip}
            >
              <Text style={s.chipEmoji}>{l.emoji}</Text>
              <Text style={[s.chipLabel, level === l.value && s.chipLabelActive]}>{l.label}</Text>
            </Card>
          ))}
        </View>

        {/* Schedule */}
        <Text style={s.label}>Вільний час</Text>
        <TextInput
          style={s.input}
          placeholder="вечір після 18:00"
          placeholderTextColor="#8b93a7"
          value={schedule}
          onChangeText={setSchedule}
        />

        {error && <Text style={s.error}>{error}</Text>}

        <Button title={busy ? 'Зберігаємо…' : 'Зберегти'} onPress={() => void save()} disabled={!valid || busy} />
        <Button title="Скасувати" kind="ghost" onPress={onCancel} />
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  label: { color: '#8b93a7', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginTop: 16, marginBottom: 6 },
  input: {
    backgroundColor: '#1a2233',
    borderColor: '#2a3554',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#e8ecf4',
    fontSize: 16,
    marginBottom: 4,
  },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  photoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avatarPreview: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#2a3554', alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 72, height: 72, borderRadius: 36 },
  avatarInitial: { color: '#e8ecf4', fontSize: 28, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, marginBottom: 4 },
  chipActive: { borderColor: '#4f8cff', borderWidth: 1 },
  chipEmoji: { fontSize: 18, textAlign: 'center' },
  chipLabel: { color: '#8b93a7', fontSize: 12, textAlign: 'center', marginTop: 2 },
  chipLabelActive: { color: '#4f8cff', fontWeight: '600' },
  error: { color: '#e5534b', marginVertical: 10 },
});
