import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput } from 'react-native';
import { api } from '../api';
import { useOnboarding } from '../onboarding/store';
import { useAuth } from '../auth';
import { Button, Screen, Subtitle, Title } from '../ui';

/**
 * Registration wall (story #6): appears only AFTER the value preview.
 * Sends the selections made during onboarding so the profile is complete
 * from the first second.
 */
export function RegisterScreen() {
  const { state, complete } = useOnboarding();
  const { setToken } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.register({
        email: email.trim(),
        password,
        name: name.trim(),
        goal: state.goal,
        level: state.level,
        gymId: state.gym?.id,
      });
      setToken(res.tokens.accessToken);
      complete(res.tokens.accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вдалося зареєструватися');
    } finally {
      setBusy(false);
    }
  }

  const valid = name.trim().length >= 2 && /\S+@\S+\.\S+/.test(email) && password.length >= 8;

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Title>Створи акаунт</Title>
        <Subtitle>Ще крок — і можна писати партнерам</Subtitle>

        <TextInput style={s.input} placeholder="Імʼя" placeholderTextColor="#8b93a7" value={name} onChangeText={setName} />
        <TextInput
          style={s.input}
          placeholder="Email"
          placeholderTextColor="#8b93a7"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={s.input}
          placeholder="Пароль (мін. 8 символів)"
          placeholderTextColor="#8b93a7"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error && <Text style={s.error}>{error}</Text>}

        <Button title={busy ? 'Створюємо…' : 'Зареєструватися'} onPress={() => void submit()} disabled={!valid || busy} />
        {/* Social sign-in (Google/Apple) — same /auth/social endpoint, wired when Firebase keys arrive (Part 0 note). */}
        <Button title="Продовжити з Google" kind="ghost" disabled onPress={() => undefined} />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = StyleSheet.create({
  input: {
    backgroundColor: '#1a2233',
    borderColor: '#2a3554',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#e8ecf4',
    fontSize: 16,
    marginBottom: 12,
  },
  error: { color: '#e5534b', marginBottom: 8 },
});
