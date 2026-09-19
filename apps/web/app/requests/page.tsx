'use client';

import { useState } from 'react';
import { REQUESTS_INBOX, GOAL_LABEL, LEVEL_LABEL, type IncomingRequest } from '@/lib/mock';

export default function Requests() {
  const [handled, setHandled] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);

  function respond(r: IncomingRequest, accept: boolean) {
    setHandled((h) => ({ ...h, [r.id]: true }));
    setToast(accept ? `Запит прийнято: ${r.fromName.split(' ')[0]} 🤝` : `Запит відхилено`);
    setTimeout(() => setToast(null), 2000);
  }

  const pending = REQUESTS_INBOX.filter((r) => !handled[r.id]);

  return (
    <main className="container" style={{ maxWidth: 720 }}>
      <h1 className="page-title">Запити на партнера</h1>
      <p className="page-sub">З вами хочуть тренуватися (вхідні запити).</p>

      {pending.length === 0 ? (
        <p className="card">Ви розглянули всі запити. Скоріше, нового партнера! 🎉</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pending.map((r) => (
            <div key={r.id} className="card">
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ fontSize: 30 }}>{r.fromAvatar}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800 }}>{r.fromName}</div>
                  <div className="partner-meta">
                    {LEVEL_LABEL[r.level]} · {GOAL_LABEL[r.goal]} · {r.gymName} · {r.at}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button className="btn" onClick={() => respond(r, true)}>Прийняти</button>
                <button className="btn ghost" onClick={() => respond(r, false)}>Відхилити</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
