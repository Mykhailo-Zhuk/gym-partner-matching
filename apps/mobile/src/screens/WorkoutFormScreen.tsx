import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { MatchListItem } from '../api';
import { authApi } from '../api';
import { useAuth } from '../auth';
import { Button, Card, Screen, Title } from '../ui';

const WORKOUT_TYPES = ['груди', 'спина', 'ноги', 'плечі', 'руки', 'прес', 'кардіо', 'все тіло'];

interface Props {
  match: MatchListItem;
  onBack: () => void;
  onDone: () => void;
}

export function WorkoutFormScreen({ match, onBack, onDone }: Props) {
  const { token } = useAuth();
  const api = authApi(token!);
  const [date, setDate] = useState(new Date());
  const [showDate, setShowDate] = useState(false);
  const [type, setType] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!type.trim()) {
      setError('Обери тип тренування');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.addWorkout(match.id, {
        date: date.toISOString().split('T')[0],
        type: type.trim(),
        sets: sets ? parseInt(sets, 10) : undefined,
        reps: reps ? parseInt(reps, 10) : undefined,
        weightKg: weight ? parseFloat(weight) : undefined,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося зберегти');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={s.header}>
        <Pressable onPress={onBack}><Text style={s.back}>← Назад</Text></Pressable>
      </View>
      <Title style={{ marginTop: 8, marginBottom: 16 }}>Додати тренування</Title>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Date */}
        <Text style={s.label}>Дата</Text>
        <Pressable style={s.picker} onPress={() => setShowDate(true)}>
          <Text style={s.pickerText}>
            {date.toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'short' })}
          </Text>
        </Pressable>
        {showDate && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            onChange={(_, v) => {
              setShowDate(Platform.OS === 'ios');
              if (v) setDate(v);
            }}
          />
        )}

        {/* Type chips */}
        <Text style={s.label}>Тип</Text>
        <View style={s.chips}>
          {WORKOUT_TYPES.map((t) => (
            <Pressable
              key={t}
              style={[s.chip, type === t && s.chipActive]}
              onPress={() => setType(type === t ? '' : t)}
            >
              <Text style={[s.chipText, type === t && s.chipTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        {/* Sets / Reps / Weight */}
        <View style={s.row}>
          <View style={s.field}>
            <Text style={s.label}>Підходи</Text>
            <TextInput style={s.input} placeholder="3" placeholderTextColor="#8b93a7" keyboardType="number-pad" value={sets} onChangeText={setSets} />
          </View>
          <View style={s.field}>
            <Text style={s.label}>Повторення</Text>
            <TextInput style={s.input} placeholder="10" placeholderTextColor="#8b93a7" keyboardType="number-pad" value={reps} onChangeText={setReps} />
          </View>
          <View style={s.field}>
            <Text style={s.label}>Вага (кг)</Text>
            <TextInput style={s.input} placeholder="60" placeholderTextColor="#8b93a7" keyboardType="decimal-pad" value={weight} onChangeText={setWeight} />
          </View>
        </View>

        {error && <Text style={s.error}>{error}</Text>}
        <Button title={busy ? 'Зберігаємо…' : 'Додати'} onPress={() => void submit()} disabled={busy} />
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { marginBottom: 8 },
  back: { color: '#4f8cff', fontSize: 16 },
  label: { color: '#8b93a7', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginTop: 16, marginBottom: 6 },
  picker: { backgroundColor: '#1a2233', borderRadius: 10, padding: 14 },
  pickerText: { color: '#e8ecf4', fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#1a2233', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#2a3554' },
  chipActive: { backgroundColor: '#4f8cff', borderColor: '#4f8cff' },
  chipText: { color: '#8b93a7', fontSize: 14 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  row: { flexDirection: 'row', gap: 12 },
  field: { flex: 1 },
  input: { backgroundColor: '#1a2233', borderRadius: 10, padding: 12, color: '#e8ecf4', fontSize: 16, textAlign: 'center', marginTop: 4 },
  error: { color: '#e5534b', marginVertical: 10 },
});
