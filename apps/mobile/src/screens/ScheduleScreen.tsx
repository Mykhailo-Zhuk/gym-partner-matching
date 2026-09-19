import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { MatchListItem } from '../api';
import { authApi } from '../api';
import { useAuth } from '../auth';
import { Button, Card, Screen, Title } from '../ui';

interface Props {
  match: MatchListItem;
  onBack: () => void;
}

/** Date/time picker to schedule a workout (story #4). */
export function ScheduleScreen({ match, onBack }: Props) {
  const { token } = useAuth();
  const api = authApi(token!);
  const [date, setDate] = useState(
    match.scheduledAt ? new Date(match.scheduledAt) : new Date(Date.now() + 86400000),
  );
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function fmt(d: Date) {
    return d.toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function fmtTime(d: Date) {
    return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.scheduleMatch(match.id, date.toISOString());
      onBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося зберегти');
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await api.scheduleMatch(match.id, null);
      onBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося скасувати');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={cs.header}>
        <Pressable onPress={onBack}><Text style={cs.back}>← Назад</Text></Pressable>
      </View>
      <Title style={{ marginTop: 12, marginBottom: 4 }}>Призначити тренування</Title>
      <Text style={cs.sub}>з {match.partner.name}</Text>

      <Card style={{ marginTop: 24 }}>
        <Text style={cs.label}>Дата</Text>
        <Pressable style={cs.picker} onPress={() => setShowDate(true)}>
          <Text style={cs.pickerText}>{fmt(date)}</Text>
        </Pressable>
        {showDate && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={new Date()}
            onChange={(_, v) => {
              setShowDate(Platform.OS === 'ios');
              if (v) {
                const next = new Date(date);
                next.setFullYear(v.getFullYear(), v.getMonth(), v.getDate());
                setDate(next);
              }
            }}
          />
        )}

        <Text style={cs.label}>Час</Text>
        <Pressable style={cs.picker} onPress={() => setShowTime(true)}>
          <Text style={cs.pickerText}>{fmtTime(date)}</Text>
        </Pressable>
        {showTime && (
          <DateTimePicker
            value={date}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, v) => {
              setShowTime(Platform.OS === 'ios');
              if (v) {
                const next = new Date(date);
                next.setHours(v.getHours(), v.getMinutes());
                setDate(next);
              }
            }}
          />
        )}
      </Card>

      {error && <Text style={cs.error}>{error}</Text>}

      <Button title={busy ? 'Зберігаємо…' : 'Зберегти'} onPress={() => void save()} disabled={busy} />
      <Button title="Скасувати тренування" kind="ghost" onPress={() => void cancel()} disabled={busy} />
    </Screen>
  );
}

const cs = StyleSheet.create({
  header: { marginBottom: 8 },
  back: { color: '#4f8cff', fontSize: 16 },
  sub: { color: '#8b93a7', fontSize: 15, marginBottom: 8 },
  label: { color: '#8b93a7', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginTop: 14, marginBottom: 6 },
  picker: { backgroundColor: '#0f1420', borderRadius: 10, padding: 14 },
  pickerText: { color: '#e8ecf4', fontSize: 16 },
  error: { color: '#e5534b', marginVertical: 10 },
});
