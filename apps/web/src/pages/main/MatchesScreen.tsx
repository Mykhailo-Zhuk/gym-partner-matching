import { useCallback, useEffect, useState } from 'react';
import { authApi, type MatchListItem } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { Loading, Screen, Title } from '../../components/ui/Screen';

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

interface Props {
  onOpenChat: (matchId: string, match: MatchListItem) => void;
  onSchedulePress?: (match: MatchListItem) => void;
  onDashboardPress?: (match: MatchListItem) => void;
}

export function MatchesScreen({ onOpenChat, onSchedulePress, onDashboardPress }: Props) {
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
        <p className="text-muted text-center mt-10">Партнери зʼявляться після взаємного запиту</p>
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
      <div
        key={item.id}
        className="flex flex-row items-center py-3 border-b border-card cursor-pointer hover:bg-card/30 transition-colors"
        onClick={() => onOpenChat(item.id, item)}
      >
        <div className="w-[52px] h-[52px] rounded-full bg-border flex items-center justify-center shrink-0 mr-3">
          {item.partner.photoUrl ? (
            <img src={item.partner.photoUrl} alt="" className="w-[52px] h-[52px] rounded-full object-cover" />
          ) : (
            <span className="text-text text-[20px] font-bold">{item.partner.name[0]}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-row justify-between items-center">
            <p className="text-text text-[16px] font-semibold">{item.partner.name}</p>
            {item.lastMessage && (
              <span className="text-muted text-[12px] shrink-0 ml-2">{timeAgo(item.lastMessage.createdAt)}</span>
            )}
          </div>
          <p className="text-muted text-[13px] truncate">{preview}</p>
          {item.scheduledAt && (
            <p className="text-accent text-[12px]">
              🕒 {new Date(item.scheduledAt).toLocaleDateString('uk-UA', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1 ml-2 shrink-0">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDashboardPress?.(item); }}
            className="p-1 text-[18px]"
          >
            📊
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onSchedulePress?.(item); }}
            className="p-1 text-[18px]"
          >
            🕒
          </button>
        </div>
        {item.status !== 'ACTIVE' && (
          <span className="ml-2 text-muted text-[11px] bg-card rounded-lg px-2 py-1">Завершено</span>
        )}
      </div>
    );
  }

  return (
    <Screen>
      <Title style={{ marginBottom: 16 }}>Матчі</Title>
      {error && <p className="text-error mb-3">{error}</p>}
      {active.length > 0 && active.map(renderItem)}
      {ended.length > 0 && (
        <>
          <p className="text-muted text-[12px] font-semibold uppercase mt-4 mb-2">Завершені</p>
          {ended.map(renderItem)}
        </>
      )}
    </Screen>
  );
}
