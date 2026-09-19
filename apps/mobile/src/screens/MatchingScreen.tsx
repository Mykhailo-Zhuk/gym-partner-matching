import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Goal, Level, SearchCard } from '../api';
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

const GOALS: Goal[] = ['MASS', 'CUT', 'STRENGTH', 'ENDURANCE', 'GENERAL'];
const LEVELS: Level[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

type FilterState = { goal?: Goal; level?: Level; schedule?: string; gymId?: string };

export function MatchingScreen({ onShowProfile }: { onShowProfile: (userId: string) => void }) {
  const { token } = useAuth();
  const api = authApi(token!);

  const [filters, setFilters] = useState<FilterState>({});
  const [cards, setCards] = useState<SearchCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());

  const search = useCallback(
    async (f: FilterState) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.search(f);
        setCards(res.cards);
        if (res.cards.length === 0) setError('Нікого не знайдено. Спробуй розширити пошук.');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Помилка пошуку');
      } finally {
        setLoading(false);
      }
    },
    [api],
  );

  // Auto-search on mount
  useEffect(() => { void search({}); }, [search]);

  async function sendRequest(userId: string) {
    try {
      await api.sendRequest(userId);
      setSent((prev) => new Set([...prev, userId]));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося надіслати запит');
    }
  }

  function toggleFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((prev) => ({ ...prev, [key]: prev[key] === value ? undefined : value }));
  }

  function widenSearch() {
    // Drop one filter at a time progressively
    if (filters.goal) { setFilters((f) => ({ ...f, goal: undefined })); }
    else if (filters.level) { setFilters((f) => ({ ...f, level: undefined })); }
    else if (filters.schedule) { setFilters((f) => ({ ...f, schedule: undefined })); }
    else { setFilters({}); }
  }

  function renderCard({ item }: { item: SearchCard }) {
    const requested = sent.has(item.id);
    return (
      <Card onPress={() => onShowProfile(item.id)}>
        <View style={cs.row}>
          <View style={cs.avatar}>
            {item.photoUrl ? (
              <Image source={{ uri: item.photoUrl }} style={cs.avatarImg} />
            ) : (
              <Text style={cs.avatarInitial}>{item.firstName[0]}</Text>
            )}
          </View>
          <View style={cs.info}>
            <Text style={cs.name}>{item.firstName}{item.lastName ? ` ${item.lastName}` : ''}</Text>
            <Text style={cs.meta}>
              {LEVEL_LABEL[item.level] ?? item.level} · {GOAL_LABEL[item.goal] ?? item.goal}
              {item.gymName ? ` · ${item.gymName}` : ''}
            </Text>
            {item.schedule ? <Text style={cs.schedule}>🕒 {item.schedule}</Text> : null}
            {item.bio ? <Text style={cs.bio} numberOfLines={2}>{item.bio}</Text> : null}
          </View>
        </View>
        <Button
          title={requested ? 'Запит надіслано' : 'Запросити'}
          onPress={() => void sendRequest(item.id)}
          disabled={requested}
        />
      </Card>
    );
  }

  return (
    <Screen>
      <ScrollView horizontal={false} showsVerticalScrollIndicator={false}>
        <Title>Знайти партнера</Title>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={cs.filters}>
          {GOALS.map((g) => (
            <Pressable
              key={g}
              style={[cs.chip, filters.goal === g && cs.chipActive]}
              onPress={() => toggleFilter('goal', g)}
            >
              <Text style={[cs.chipText, filters.goal === g && cs.chipTextActive]}>
                {GOAL_LABEL[g]}
              </Text>
            </Pressable>
          ))}
          {LEVELS.map((l) => (
            <Pressable
              key={l}
              style={[cs.chip, filters.level === l && cs.chipActive]}
              onPress={() => toggleFilter('level', l)}
            >
              <Text style={[cs.chipText, filters.level === l && cs.chipTextActive]}>
                {LEVEL_LABEL[l]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={cs.actions}>
          <Button title="Шукати" onPress={() => void search(filters)} />
        </View>

        {loading && <Loading />}
        {error && <Text style={cs.error}>{error}</Text>}

        {cards.length > 0 ? (
          <FlatList
            data={cards}
            renderItem={renderCard}
            keyExtractor={(c) => c.id}
            scrollEnabled={false}
          />
        ) : !loading && !error ? (
          <Text style={cs.empty}>Завантаж…</Text>
        ) : (
          <Button title="Розширити пошук" kind="ghost" onPress={widenSearch} />
        )}
      </ScrollView>
    </Screen>
  );
}

const cs = StyleSheet.create({
  filters: { flexDirection: 'row', marginVertical: 12 },
  chip: {
    backgroundColor: '#1a2233',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#2a3554',
  },
  chipActive: { backgroundColor: '#4f8cff', borderColor: '#4f8cff' },
  chipText: { color: '#8b93a7', fontSize: 14 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  actions: { marginBottom: 12 },
  row: { flexDirection: 'row', marginBottom: 12 },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#2a3554',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  avatarImg: { width: 52, height: 52, borderRadius: 26 },
  avatarInitial: { color: '#e8ecf4', fontSize: 20, fontWeight: '700' },
  info: { flex: 1 },
  name: { color: '#e8ecf4', fontSize: 17, fontWeight: '600' },
  meta: { color: '#8b93a7', fontSize: 13, marginTop: 2 },
  schedule: { color: '#8b93a7', fontSize: 13, marginTop: 2 },
  bio: { color: '#8b93a7', fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  error: { color: '#e5534b', marginVertical: 12 },
  empty: { color: '#8b93a7', textAlign: 'center', marginTop: 24 },
});
