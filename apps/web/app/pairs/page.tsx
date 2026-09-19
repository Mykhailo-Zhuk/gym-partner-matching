import Link from 'next/link';
import { CONVERSATIONS, MY_PAIRS } from '@/lib/mock';

export default function Pairs() {
  const chatIdFor = (partnerId: string) => CONVERSATIONS.find((c) => c.partnerId === partnerId)?.id;
  return (
    <main className="container" style={{ maxWidth: 760 }}>
      <h1 className="page-title">Мої пари</h1>
      <p className="page-sub">Партнери, з якими ви вже повʼязані (активні матчі).</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {MY_PAIRS.map((m) => (
          <div key={m.id} className="card">
            <div className="chat-row">
              <div className="avatar">{m.partnerAvatar}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800 }}>{m.partnerName}</div>
                <div className="prev">{m.scheduledAt ? `⏰ ${m.scheduledAt}` : 'Розклад не вказано'} · {m.lastMessage}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              {chatIdFor(m.partnerId) ? (
                <Link href={`/chat/${chatIdFor(m.partnerId)}`} className="btn">Чат</Link>
              ) : (
                <span className="btn ghost" style={{ opacity: 0.6, cursor: 'default' }}>Чат</span>
              )}
              <Link href="/schedule" className="btn ghost">Розклад</Link>
              <Link href="/dashboard" className="btn ghost">Дашборд</Link>
              <Link href="/rating" className="btn ghost">Оцінити</Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
