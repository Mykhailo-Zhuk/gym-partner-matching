import React, { useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { IncomingRequest } from '../api';
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

export function RequestsScreen() {
  const { token } = useAuth();
  const api = authApi(token!);

  const [requests, setRequests] = useState<IncomingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listIncomingRequests();
      setRequests(res.requests);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося завантажити');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  async function handle(id: string, accept: boolean) {
    setBusy(id);
    try {
      if (accept) await api.acceptRequest(id);
      else await api.declineRequest(id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося обробити запит');
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <Screen><Loading /></Screen>;

  return (
    <Screen>
      <Title style={{ marginBottom: 16 }}>Вхідні запити</Title>
      {error && <Text style={s.error}>{error}</Text>}
      {requests.length === 0 ? (
        <Text style={s.empty}>Немає вхідних запитів</Text>
      ) : (
        requests.map((req) => {
          const u = req.fromUser;
          return (
            <Card key={req.id} style={{ marginBottom: 14 }}>
              <View style={s.row}>
                <View style={s.avatar}>
                  {u.photoUrl ? (
                    <Image source={{ uri: u.photoUrl }} style={s.avatarImg} />
                  ) : (
                    <Text style={s.initial}>{u.name[0]}</Text>
                  )}
                </View>
                <View style={s.info}>
                  <Text style={s.name}>{u.name}</Text>
                  <Text style={s.meta}>
                    {LEVEL_LABEL[u.level] ?? u.level} · {GOAL_LABEL[u.goal] ?? u.goal}
                    {u.gym ? ` · ${u.gym.name}` : ''}
                  </Text>
                </View>
              </View>
              <View style={s.btns}>
                <Button
                  title="Прийняти"
                  onPress={() => void handle(req.id, true)}
                  disabled={busy === req.id}
                />
                <Button
                  title="Відхилити"
                  kind="ghost"
                  onPress={() => void handle(req.id, false)}
                  disabled={busy === req.id}
                />
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', marginBottom: 14 },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#2a3554',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  avatarImg: { width: 52, height: 52, borderRadius: 26 },
  initial: { color: '#e8ecf4', fontSize: 20, fontWeight: '700' },
  info: { flex: 1, justifyContent: 'center' },
  name: { color: '#e8ecf4', fontSize: 17, fontWeight: '600' },
  meta: { color: '#8b93a7', fontSize: 13, marginTop: 2 },
  btns: { flexDirection: 'row', gap: 10 },
  error: { color: '#e5534b', marginBottom: 12 },
  empty: { color: '#8b93a7', textAlign: 'center', marginTop: 40 },
});
