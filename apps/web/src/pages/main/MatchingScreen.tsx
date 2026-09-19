import { useCallback, useEffect, useState } from 'react';
import { authApi, type Goal, type Level, type SearchCard } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Card, Loading, Screen, Title } from '../../components/ui/Screen';

const GOAL_LABEL: Record<string, string> = {
  MASS: 'Набір маси', CUT: 'Сушка', STRENGTH: 'Сила',
  ENDURANCE: 'Витривалість', GENERAL: 'Загальна форма',
};
const LEVEL_LABEL: Record<string, string> = {
  BEGINNER: 'Новачок', INTERMEDIATE: 'Середній', ADVANCED: 'Досвідчений',
};

const GOALS: Goal[] = ['MASS', 'CUT', 'STRENGTH', 'ENDURANCE', 'GENERAL'];
const LEVELS: Level[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

type FilterState = { goal?: Goal; level?: Level };

export function MatchingScreen() {
  const { token } = useAuth();

  const [filters, setFilters] = useState<FilterState>({});
  const [cards, setCards] = useState<SearchCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());

  const search = useCallback(
    async (f: FilterState, authToken: string) => {
      setLoading(true);
      setError(null);
      try {
        const api = authApi(authToken);
        const res = await api.search(f);
        setCards(res.cards);
        if (res.cards.length === 0) setError('Нікого не знайдено. Спробуй розширити пошук.');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Помилка пошуку');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => { void search({}, token!); }, [search, token]);

  async function sendRequest(userId: string) {
    try {
      await authApi(token!).sendRequest(userId);
      setSent((prev) => new Set([...prev, userId]));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося надіслати запит');
    }
  }

  function toggleFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((prev) => ({ ...prev, [key]: prev[key] === value ? undefined : value }));
  }

  function widenSearch() {
    if (filters.goal) setFilters((f) => ({ ...f, goal: undefined }));
    else if (filters.level) setFilters((f) => ({ ...f, level: undefined }));
    else setFilters({});
    void search({}, token!);
  }

  return (
    <Screen>
      <Title>Знайти партнера</Title>

      {/* Filter chips */}
      <div className="flex flex-row flex-wrap gap-2 my-3">
        {GOALS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => toggleFilter('goal', g)}
            className={`px-4 py-2 rounded-full text-[14px] border transition-colors ${
              filters.goal === g
                ? 'bg-accent border-accent text-white'
                : 'bg-card border-border text-muted'
            }`}
          >
            {GOAL_LABEL[g]}
          </button>
        ))}
        {LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => toggleFilter('level', l)}
            className={`px-4 py-2 rounded-full text-[14px] border transition-colors ${
              filters.level === l
                ? 'bg-accent border-accent text-white'
                : 'bg-card border-border text-muted'
            }`}
          >
            {LEVEL_LABEL[l]}
          </button>
        ))}
      </div>

      <div className="mb-3">
        <Button title="Шукати" onClick={() => void search(filters, token!)} />
      </div>

      {loading && <Loading />}
      {error && <p className="text-error my-3">{error}</p>}

      {cards.length > 0 ? (
        <div>
          {cards.map((item) => {
            const requested = sent.has(item.id);
            return (
              <Card key={item.id}>
                <div className="flex flex-row gap-3 mb-3">
                  <div className="w-[52px] h-[52px] rounded-full bg-border flex items-center justify-center shrink-0">
                    {item.photoUrl ? (
                      <img src={item.photoUrl} alt="" className="w-[52px] h-[52px] rounded-full object-cover" />
                    ) : (
                      <span className="text-text text-[20px] font-bold">{item.firstName[0]}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-text text-[17px] font-semibold">
                      {item.firstName}{item.lastName ? ` ${item.lastName}` : ''}
                    </p>
                    <p className="text-muted text-[13px] mt-0.5">
                      {LEVEL_LABEL[item.level] ?? item.level} · {GOAL_LABEL[item.goal] ?? item.goal}
                      {item.gymName ? ` · ${item.gymName}` : ''}
                    </p>
                    {item.schedule && <p className="text-muted text-[13px]">🕒 {item.schedule}</p>}
                    {item.bio && <p className="text-muted text-[12px] mt-1 italic">{item.bio}</p>}
                  </div>
                </div>
                <Button
                  title={requested ? 'Запит надіслано' : 'Запросити'}
                  onClick={() => void sendRequest(item.id)}
                  disabled={requested}
                />
              </Card>
            );
          })}
        </div>
      ) : !loading && !error ? (
        <p className="text-muted text-center mt-6">Завантаж…</p>
      ) : (
        <Button title="Розширити пошук" kind="ghost" onClick={widenSearch} />
      )}
    </Screen>
  );
}
