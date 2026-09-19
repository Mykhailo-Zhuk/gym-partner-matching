import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessagePayload as MsgPayload, MatchListItem } from '../../api';
import { authApi } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import { Loading, Screen } from '../../components/ui/Screen';

interface Props {
  matchId: string;
  match: MatchListItem | null;
  onBack: () => void;
  onSchedulePress?: (match: MatchListItem) => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}

export function ChatScreen({ matchId, match, onBack, onSchedulePress }: Props) {
  const { token } = useAuth();
  const api = authApi(token!);
  const { connected, lastMessage } = useSocket(token);
  const [messages, setMessages] = useState<MsgPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const partner = match?.partner;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const msgs = await api.getMessages(matchId);
      setMessages(msgs.items);
      setCursor(msgs.nextCursor);
      setHasMore(msgs.nextCursor !== null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося завантажити');
    } finally {
      setLoading(false);
    }
  }, [api, matchId]);

  useEffect(() => { void load(); }, [load]);

  // Append realtime message
  useEffect(() => {
    if (!lastMessage || lastMessage.matchId !== matchId) return;
    setMessages((prev) => {
      if (prev.some((m) => m.id === lastMessage.id)) return prev;
      return [...prev, lastMessage];
    });
  }, [lastMessage, matchId]);

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function loadMore() {
    if (!cursor || !hasMore) return;
    try {
      const res = await api.getMessages(matchId, cursor);
      setMessages((prev) => [...res.items, ...prev]);
      setCursor(res.nextCursor);
      setHasMore(res.nextCursor !== null);
    } catch { /* silent */ }
  }

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setText('');
    setSending(true);
    try {
      const msg = await api.sendMessage(matchId, body);
      setMessages((prev) => [...prev, msg]);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося надіслати');
      setText(body);
    } finally {
      setSending(false);
    }
  }

  if (loading) return <Screen><Loading /></Screen>;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-row items-center bg-card px-4 py-3 border-b border-border"
        style={{ paddingTop: 40 }}
      >
        <button type="button" onClick={onBack} className="mr-3 text-accent text-[22px]">←</button>
        <div className="flex-1">
          <p className="text-text text-[17px] font-bold">{partner?.name ?? 'Чат'}</p>
          <p className="text-muted text-[12px]">{connected ? '🟢 онлайн' : '⚫ офлайн'}</p>
        </div>
        {match && (
          <button
            type="button"
            onClick={() => onSchedulePress?.(match)}
            className="ml-2 text-[20px]"
          >
            🕒
          </button>
        )}
      </div>

      {/* Messages */}
      {error && <p className="text-error text-[13px] px-4 py-2">{error}</p>}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {hasMore && (
          <button
            type="button"
            onClick={() => void loadMore()}
            className="block w-full text-center text-muted text-[13px] py-2 hover:text-accent transition-colors"
          >
            Завантажити більше
          </button>
        )}
        {messages.map((item) => {
          const isSystem = item.type === 'SYSTEM';
          if (isSystem) {
            return (
              <div key={item.id} className="flex justify-center my-2">
                <span className="text-muted text-[13px] italic">{item.body}</span>
              </div>
            );
          }
          const isMe = item.senderId !== null; // TODO: compare with actual userId
          return (
            <div
              key={item.id}
              className={`flex flex-row items-end gap-2 mb-2 ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              {!isMe && (
                <div className="w-7 h-7 rounded-full bg-border flex items-center justify-center shrink-0 mb-1">
                  <span className="text-text text-[12px] font-bold">{(item.senderName ?? '?')[0]}</span>
                </div>
              )}
              <div
                className={`max-w-[72%] rounded-2xl px-4 py-2 ${
                  isMe ? 'bg-accent rounded-br-md' : 'bg-card rounded-bl-md'
                }`}
              >
                {item.body && <p className="text-text text-[15px] leading-5">{item.body}</p>}
                <p
                  className={`text-[11px] mt-1 ${
                    isMe ? 'text-white/60 text-right' : 'text-muted/70'
                  }`}
                >
                  {formatTime(item.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex flex-row items-center px-4 py-3 bg-card border-t border-border pb-6">
        <input
          type="text"
          className="flex-1 bg-bg rounded-full px-4 py-2.5 text-text text-[15px"
          style={{ paddingRight: 42 }}
          placeholder="Повідомлення…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void send(); }}
          disabled={sending}
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={!text.trim() || sending}
          className={`-ml-12 w-10 h-10 rounded-full flex items-center justify-center transition-opacity ${
            text.trim() && !sending ? 'bg-accent' : 'bg-accent/40'
          }`}
        >
          <span className="text-white text-[20px] font-bold">↑</span>
        </button>
      </div>
    </div>
  );
}
