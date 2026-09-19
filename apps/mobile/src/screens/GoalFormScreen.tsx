import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { GoalMetric, MatchListItem } from '../api';
import { authApi } from '../api';
import { useAuth } from '../auth';
import { Button, Card, Screen, Title } from '../ui';

interface Props {
  match: MatchListItem;
  onBack: () => void;
  onDone: () => void;
}

export function GoalFormScreen({ match, onBack, onDone }: Props) {
  const { token } = useAuth();
  const api = authApi(token!);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [metric, setMetric] = useState<GoalMetric>('WORKOUT_COUNT');
  const [due, setDue] = useState<Date | null>(null);
  const [showDate, setShowDate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!title.trim() || !target) {
      setError('Заповни всі поля');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.createGoal(match.id, {
        title: title.trim(),
        target: parseInt(target, 10),
        metric,
        due: due ? due.toISOString().split('T')[0] : undefined,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося створити');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={s.header}>
        <Pressable onPress={onBack}><Text style={s.back}>← Назад</Text></Pressable>
      </View>
      <Title style={{ marginTop: 8, marginBottom: 16 }}>Нова ціль</Title>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={s.label}>Назва</Text>
        <TextInput
          style={s.input}
          placeholder="10 тренувань за місяць"
          placeholderTextColor="#8b93a7"
          value={title}
          onChangeText={setTitle}
        />

        <Text style={s.label}>Метрика</Text>
        <View style={s.metricRow}>
          <Card
            onPress={() => setMetric('WORKOUT_COUNT')}
            style={[s.metricCard, metric === 'WORKOUT_COUNT' && s.metricActive]}
          >
            <Text style={s.metricEmoji}>🏋️</Text>
            <Text style={[s.metricText, metric === 'WORKOUT_COUNT' && s.metricTextActive]}>Кількість тренувань</Text>
          </Card>
          <Card
            onPress={() => setMetric('TOTAL_KG')}
            style={[s.metricCard, metric === 'TOTAL_KG' && s.metricActive]}
          >
            <Text style={s.metricEmoji}>⚡</Text>
            <Text style={[s.metricText, metric === 'TOTAL_KG' && s.metricTextActive]}>Загальна вага (кг)</Text>
          </Card>
        </View>

        <Text style={s.label}>Ціль</Text>
        <TextInput
          style={s.input}
          placeholder={metric === 'WORKOUT_COUNT' ? '10' : '5000'}
          placeholderTextColor="#8b93a7"
          keyboardType="number-pad"
          value={target}
          onChangeText={setTarget}
        />

        <Text style={s.label}>Дедлайн (необовʼязково)</Text>
        <Pressable style={s.picker} onPress={() => setShowDate(true)}>
          <Text style={s.pickerText}>{due ? due.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Без дедлайну'}</Text>
        </Pressable>
        {showDate && (
          <DateTimePicker
            value={due ?? new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={new Date()}
            onChange={(_, v) => {
              setShowDate(Platform.OS === 'ios');
              if (v) setDue(v);
            }}
          />
        )}

        {error && <Text style={s.error}>{error}</Text>}
        <Button title={busy ? 'Створюємо…' : 'Створити ціль'} onPress={() => void submit()} disabled={busy} />
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { marginBottom: 8 },
  back: { color: '#4f8cff', fontSize: 16 },
  label: { color: '#8b93a7', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginTop: 16, marginBottom: 6 },
  input: { backgroundColor: '#1a2233', borderRadius: 10, padding: 14, color: '#e8ecf4', fontSize: 16 },
  metricRow: { flexDirection: 'row', gap: 10 },
  metricCard: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  metricActive: { borderColor: '#4f8cff', borderWidth: 1 },
  metricEmoji: { fontSize: 24, marginBottom: 4 },
  metricText: { color: '#8b93a7', fontSize: 12, textAlign: 'center' },
  metricTextActive: { color: '#4f8cff', fontWeight: '600' },
  picker: { backgroundColor: '#1a2233', borderRadius: 10, padding: 14 },
  pickerText: { color: '#e8ecf4', fontSize: 16 },
  error: { color: '#e5534b', marginVertical: 10 },
});
