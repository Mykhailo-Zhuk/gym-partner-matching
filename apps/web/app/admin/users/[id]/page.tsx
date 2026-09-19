'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ADMIN_USERS, GOAL_LABEL, LEVEL_LABEL } from '@/lib/mock';

export default function AdminUserDetail() {
  const params = useParams<{ id: string }>();
  const found = ADMIN_USERS.find((u) => u.id === params?.id);
  const [status, setStatus] = useState<'ACTIVE' | 'BLOCKED'>(found?.status ?? 'ACTIVE');
  const [reason, setReason] = useState('');

  if (!found) {
    return (
      <main className="container" style={{ maxWidth: 720 }}>
        <h1 className="page-title">Користувача не знайдено</h1>
        <Link href="/admin/users" className="btn ghost">До списку</Link>
      </main>
    );
  }

  if (typeof window !== 'undefined' && !localStorage.getItem('gymbros_admin')) {
    return (
      <main className="container">
        <h1 className="page-title">Доступ лише для адміністраторів</h1>
        <Link href="/admin" className="btn ghost">Увійти</Link>
      </main>
    );
  }

  const blocked = status === 'BLOCKED';

  function toggle() {
    setStatus(blocked ? 'ACTIVE' : 'BLOCKED');
    setReason('');
  }

  return (
    <main className="container" style={{ maxWidth: 640 }}>
      <Link href="/admin/users" className="btn ghost" style={{ marginBottom: 14 }}>← Усі користувачі</Link>

      <div className="card">
        <div style={{ fontWeight: 800, fontSize: 20 }}>{found.name}</div>
        <div className="partner-meta">{found.email}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <span className="chip">{LEVEL_LABEL[found.level]}</span>
          <span className="chip">{GOAL_LABEL[found.goal]}</span>
          <span className="chip">{found.gymName}</span>
          <span className="chip" style={{ background: found.reports > 0 ? '#fecaca' : '#eef2f7' }}>
            {found.reports > 0 ? `⚠ ${found.reports} репортів` : 'Репортів немає'}
          </span>
          <span className="chip" style={{ background: blocked ? '#fecaca' : '#dcfce7' }}>
            {blocked ? 'Блокований' : 'Активний'}
          </span>
        </div>

        {blocked ? (
          <p style={{ color: '#dc2626' }}>Акаунт заблоковано.</p>
        ) : (
          <div style={{ marginTop: 18 }}>
            <div className="field">
              <label>Причина блокування</label>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Порушення правил спільноти…" />
            </div>
            <button className="btn" style={{ background: '#dc2626' }} disabled={!reason.trim()} onClick={toggle}>
              Заблокувати
            </button>
          </div>
        )}

        {blocked && (
          <div style={{ marginTop: 18 }}>
            <button className="btn ghost" onClick={toggle}>Розблокувати</button>
          </div>
        )}
      </div>
    </main>
  );
}
