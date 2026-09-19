import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MatchListItem } from '../api';
import { authApi } from '../api';
import { useAuth } from '../auth';
import { Loading, Screen, Title } from '../ui';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'щойно';
  if (mins < 60) return `${mins}хв`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}год`;
  const days = Math.floor(hrs / 24);
  return `${days}дн`;
}

export function MatchesScreen({ onOpenChat, onSchedulePress, onDashboardPress }: {
  onOpenChat: (matchId: string, match: MatchListItem) => void;
  onSchedulePress?: (match: MatchListItem) => void;
  onDashboardPress?: (match: MatchListItem) => void;
}) {
  const { token } = useAuth();
  const api = authApi(token!);
  const [items, setItems] = useState<MatchListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getMatches();
      setItems(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося завантажити');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <Screen><Loading /></Screen>;

  const active = items.filter((m) => m.status === 'ACTIVE');
  const ended = items.filter((m) => m.status !== 'ACTIVE');

  if (items.length === 0) {
    return (
      <Screen>
        <Title style={{ marginBottom: 6 }}>Матчі</Title>
        <Text style={s.empty}>Партнери зʼявляться після взаємного запиту</Text>
      </Screen>
    );
  }

  function renderItem(item: MatchListItem) {
    const msg = item.lastMessage;
    const preview = msg
      ? msg.type === 'SYSTEM'
        ? msg.body
        : msg.type === 'IMAGE'
        ? '📷 Фото'
        : msg.body ?? ''
      : 'Ще немає повідомлень';

    return (
      <Pressable key={item.id} style={s.row} onPress={() => onOpenChat(item.id, item)}>
        <View style={s.avatar}>
          {item.partner.photoUrl ? (
            <Image source={{ uri: item.partner.photoUrl }} style={s.avatarImg} />
          ) : (
            <Text style={s.initial}>{item.partner.name[0]}</Text>
          )}
        </View>
        <View style={s.info}>
          <Pressable onPress={() => onSchedulePress?.(item)} style={s.scheduleBtn}>
            <Text style={s.scheduleBtnText}>🕒</Text>
          </Pressable>
          <View style={s.rowHeader}>
            <Text style={s.name}>{item.partner.name}</Text>
            {item.lastMessage && (
              <Text style={s.time}>{timeAgo(item.lastMessage.createdAt)}</Text>
            )}
          </View>
          <Text style={s.preview} numberOfLines={1}>{preview}</Text>
          {item.scheduledAt && (
            <Text style={s.scheduled}>🕒 {new Date(item.scheduledAt).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
          )}
        </View>
        <View style={s.actions}>
          <Pressable onPress={() => onDashboardPress?.(item)} style={s.actionBtn}>
            <Text style={s.actionBtnText}>📊</Text>
          </Pressable>
          <Pressable onPress={() => onSchedulePress?.(item)} style={s.actionBtn}>
            <Text style={s.actionBtnText}>🕒</Text>
          </Pressable>
        </View>
        {item.status !== 'ACTIVE' && <Text style={s.endedBadge}>Завершено</Text>}
      </Pressable>
    );
  }

  return (
    <Screen>
      <Title style={{ marginBottom: 16 }}>Матчі</Title>
      {error && <Text style={s.error}>{error}</Text>}
      {active.length > 0 && (
        <>
          {active.map(renderItem)}
          {ended.length > 0 && <View style={s.divider} />}
        </>
      )}
      {ended.length > 0 && (
        <>
          <Text style={s.sectionHeader}>Завершені</Text>
          {ended.map(renderItem)}
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a2233' },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#2a3554', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarImg: { width: 52, height: 52, borderRadius: 26 },
  initial: { color: '#e8ecf4', fontSize: 20, fontWeight: '700' },
  info: { flex: 1 },
  scheduleBtn: { padding: 4 },
  scheduleBtnText: { fontSize: 18 },
  actions: { flexDirection: 'row', gap: 6 },
  actionBtn: { padding: 4 },
  actionBtnText: { fontSize: 18 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: '#e8ecf4', fontSize: 16, fontWeight: '600' },
  time: { color: '#8b93a7', fontSize: 12 },
  preview: { color: '#8b93a7', fontSize: 13, marginTop: 2 },
  scheduled: { color: '#4f8cff', fontSize: 12, marginTop: 2 },
  endedBadge: { color: '#8b93a7', fontSize: 11, backgroundColor: '#1a2233', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  sectionHeader: { color: '#8b93a7', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginTop: 16, marginBottom: 8 },
  divider: { height: 1, backgroundColor: '#1a2233', marginVertical: 8 },
  empty: { color: '#8b93a7', textAlign: 'center', marginTop: 40 },
  error: { color: '#e5534b', marginBottom: 12 },
});
