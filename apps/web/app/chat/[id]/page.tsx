'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CONVERSATIONS, type ChatMessage } from '@/lib/mock';

export default function ChatWindow() {
  const params = useParams<{ id: string }>();
  const conv = CONVERSATIONS.find((c) => c.id === params?.id);

  const [messages, setMessages] = useState<ChatMessage[]>(conv ? conv.messages : []);
  const [text, setText] = useState('');

  if (!conv) {
    return (
      <main className="container" style={{ maxWidth: 760 }}>
        <h1 className="page-title">Бесіду не знайдено</h1>
        <Link href="/chat" className="btn ghost">До списку чатів</Link>
      </main>
    );
  }

  function send() {
    const body = text.trim();
    if (!body) return;
    setMessages((m) => [...m, { id: 'local-' + Date.now(), fromMe: true, body, at: 'тепер' }]);
    setText('');
  }

  return (
    <main className="container" style={{ maxWidth: 760 }}>
      <Link href="/chat" className="btn ghost" style={{ marginBottom: 14 }}>← Чати</Link>
      <div className="card chat-window">
        <div className="chat-row" style={{ padding: '8px 6px 14px', borderBottom: '1px solid var(--ring)' }}>
          <div className="avatar">{conv.partnerAvatar}</div>
          <div style={{ fontWeight: 800 }}>{conv.partnerName}</div>
        </div>
        <div className="messages">
          {messages.map((m) => (
            <div key={m.id} className={`bubble ${m.fromMe ? 'me' : 'them'}`}>
              {m.body}
              <div className="at">{m.at}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, borderTop: '1px solid var(--ring)', paddingTop: 12 }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Напишіть повідомлення…"
            style={{ flex: 1, border: '1px solid var(--ring)', borderRadius: 12, padding: '10px 12px' }}
          />
          <button className="btn" onClick={send} disabled={!text.trim()}>Надіслати</button>
        </div>
      </div>
    </main>
  );
}
