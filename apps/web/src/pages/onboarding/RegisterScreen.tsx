import { useState } from 'react';
import { api } from '../../api';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Screen, Subtitle, Title } from '../../components/ui/Screen';

interface Props {
  onRegistered?: (token: string) => void;
}

export function RegisterScreen({ onRegistered }: Props) {
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
      onRegistered?.(res.tokens.accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вдалося зареєструватися');
    } finally {
      setBusy(false);
    }
  }

  const valid = name.trim().length >= 2 && /\S+@\S+\.\S+/.test(email) && password.length >= 8;

  return (
    <Screen>
      <Title>Створи акаунт</Title>
      <Subtitle>Ще крок — і можна писати партнерам</Subtitle>

      <input
        type="text"
        placeholder="Імʼя"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full bg-card border border-border rounded-xl px-4 py-3 text-text text-[16px] mb-3 outline-none focus:border-accent"
      />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full bg-card border border-border rounded-xl px-4 py-3 text-text text-[16px] mb-3 outline-none focus:border-accent"
      />
      <input
        type="password"
        placeholder="Пароль (мін. 8 символів)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full bg-card border border-border rounded-xl px-4 py-3 text-text text-[16px] mb-3 outline-none focus:border-accent"
      />

      {error && <p className="text-error mb-2">{error}</p>}

      <Button
        title={busy ? 'Створюємо…' : 'Зареєструватися'}
        onClick={() => void submit()}
        disabled={!valid || busy}
      />
      <Button title="Продовжити з Google" kind="ghost" disabled onClick={() => undefined} />
    </Screen>
  );
}
