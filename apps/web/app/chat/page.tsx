import Link from 'next/link';
import { CONVERSATIONS } from '../../lib/mock';

export default function ChatList() {
  return (
    <main className="container" style={{ maxWidth: 760 }}>
      <h1 className="page-title">Чати</h1>
      <p className="page-sub">Переписка з вашими партнерами (демо).</p>

      <div className="chat-list">
        {CONVERSATIONS.map((c) => (
          <Link key={c.id} href={`/chat/${c.id}`}>
            <div className="card chat-row">
              <div className="avatar">{c.partnerAvatar}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800 }}>{c.partnerName}</div>
                <div className="prev">{c.preview}</div>
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>→</div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
