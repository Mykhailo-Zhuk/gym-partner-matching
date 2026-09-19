import { useCallback, useEffect, useState } from 'react';
import { authApi, type IncomingRequest } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Card, Loading, Screen, Title } from '../../components/ui/Screen';

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
      {error && <p className="text-error mb-3">{error}</p>}
      {requests.length === 0 ? (
        <p className="text-muted text-center mt-10">Немає вхідних запитів</p>
      ) : (
        requests.map((req) => {
          const u = req.fromUser;
          return (
            <Card key={req.id} style={{ marginBottom: 14 }}>
              <div className="flex flex-row gap-3 mb-3">
                <div className="w-[52px] h-[52px] rounded-full bg-border flex items-center justify-center shrink-0">
                  {u.photoUrl ? (
                    <img src={u.photoUrl} alt="" className="w-[52px] h-[52px] rounded-full object-cover" />
                  ) : (
                    <span className="text-text text-[20px] font-bold">{u.name[0]}</span>
                  )}
                </div>
                <div className="flex-1 flex items-center">
                  <div>
                    <p className="text-text text-[17px] font-semibold">{u.name}</p>
                    <p className="text-muted text-[13px] mt-0.5">
                      {LEVEL_LABEL[u.level] ?? u.level} · {GOAL_LABEL[u.goal] ?? u.goal}
                      {u.gym ? ` · ${u.gym.name}` : ''}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-row gap-3">
                <Button
                  title="Прийняти"
                  onClick={() => void handle(req.id, true)}
                  disabled={busy === req.id}
                />
                <Button
                  title="Відхилити"
                  kind="ghost"
                  onClick={() => void handle(req.id, false)}
                  disabled={busy === req.id}
                />
              </div>
            </Card>
          );
        })
      )}
    </Screen>
  );
}
