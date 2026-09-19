import { useState } from 'react';
import type { MatchListItem } from '../../api';
import { authApi } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Screen, Title } from '../../components/ui/Screen';

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
          punctuality: scores['punctuality']!,
          communication: scores['communication']!,
          spotting: scores['spotting']!,
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
      <div className="mb-2">
        <button type="button" onClick={onBack} className="text-accent text-[16px]">← Назад</button>
      </div>
      <Title style={{ marginTop: 8, marginBottom: 4 }}>Оцінити партнера</Title>
      <p className="text-muted text-[15px] mb-6">з {match.partner.name}</p>

      {CRITERIA.map((c) => (
        <div key={c.key} className="mb-5">
          <p className="text-text text-[16px] font-semibold mb-3">{c.label}</p>
          <div className="flex flex-row gap-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setScore(c.key, n)}
                className="text-[36px] leading-none transition-colors"
                style={{ color: (scores[c.key] ?? 0) >= n ? '#f59e0b' : '#2a3554' }}
              >
                ★
              </button>
            ))}
          </div>
        </div>
      ))}

      <p className="text-muted text-[12px] font-semibold uppercase tracking-wide mt-4 mb-2">Коментар (необовʼязково)</p>
      <textarea
        className="w-full bg-card rounded-[12px] p-3 text-text text-[15px] border border-border min-h-[80px] resize-none"
        placeholder="Як все пройшло?"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />

      {error && <p className="text-error my-3">{error}</p>}

      <div className="mt-4 space-y-3">
        <Button
          title={busy ? 'Надсилаємо…' : 'Надіслати оцінку'}
          onClick={() => void submit(false)}
          disabled={!allRated || busy}
        />
        <Button title="Пропустити" kind="ghost" onClick={() => void submit(true)} disabled={busy} />
      </div>
    </Screen>
  );
}
