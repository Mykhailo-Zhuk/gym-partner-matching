import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { MatchListItem } from '../api';
import { authApi } from '../api';
import { useAuth } from '../auth';
import { Button, Screen, Title } from '../ui';

const CRITERIA = [
  { key: 'punctuality', label: 'Пунктуальність' },
  { key: 'communication', label: 'Комунікація' },
  { key: 'spotting', label: 'Підстраховка' },
] as const;

interface Props {
  match: MatchListItem;
  onBack: () => void;
  onDone: () => void;
}

export function RatingFormScreen({ match, onBack, onDone }: Props) {
  const { token } = useAuth();
  const api = authApi(token!);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setScore(key: string, val: number) {
    setScores((prev) => ({ ...prev, [key]: val }));
  }

  const allRated = CRITERIA.every((c) => (scores[c.key] ?? 0) > 0);

  async function submit(skip: boolean) {
    setBusy(true);
    setError(null);
    try {
      if (skip) {
        await api.completeMatch(match.id);
      } else if (allRated) {
        await api.completeMatch(match.id, {
          punctuality: scores['punctuality'],
          communication: scores['communication'],
          spotting: scores['spotting'],
          comment: comment.trim() || undefined,
        });
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося завершити');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={s.header}>
        <Pressable onPress={onBack}><Text style={s.back}>← Назад</Text></Pressable>
      </View>
      <Title style={{ marginTop: 8, marginBottom: 4 }}>Оцінити партнера</Title>
      <Text style={s.sub}>з {match.partner.name}</Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        {CRITERIA.map((c) => (
          <View key={c.key} style={s.criterion}>
            <Text style={s.criterionLabel}>{c.label}</Text>
            <View style={s.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setScore(c.key, n)}>
                  <Text style={[s.star, (scores[c.key] ?? 0) >= n && s.starActive]}>★</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <Text style={s.label}>Коментар (необовʼязково)</Text>
        <TextInput
          style={s.commentInput}
          placeholder="Як все пройшло?"
          placeholderTextColor="#8b93a7"
          multiline
          numberOfLines={3}
          value={comment}
          onChangeText={setComment}
        />

        {error && <Text style={s.error}>{error}</Text>}

        <Button
          title={busy ? 'Надсилаємо…' : 'Надіслати оцінку'}
          onPress={() => void submit(false)}
          disabled={!allRated || busy}
        />
        <Button
          title="Пропустити"
          kind="ghost"
          onPress={() => void submit(true)}
          disabled={busy}
        />
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { marginBottom: 8 },
  back: { color: '#4f8cff', fontSize: 16 },
  sub: { color: '#8b93a7', fontSize: 15, marginBottom: 20 },
  criterion: { marginBottom: 20 },
  criterionLabel: { color: '#e8ecf4', fontSize: 16, fontWeight: '600', marginBottom: 10 },
  stars: { flexDirection: 'row', gap: 8 },
  star: { fontSize: 36, color: '#2a3554' },
  starActive: { color: '#f59e0b' },
  label: { color: '#8b93a7', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginTop: 16, marginBottom: 8 },
  commentInput: { backgroundColor: '#1a2233', borderRadius: 12, padding: 14, color: '#e8ecf4', fontSize: 15, minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: '#2a3554' },
  error: { color: '#e5534b', marginVertical: 10 },
});
