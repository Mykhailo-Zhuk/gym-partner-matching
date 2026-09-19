'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ADMIN_USERS, GOAL_LABEL, LEVEL_LABEL } from '@/lib/mock';

export default function AdminUsers() {
  const [search, setSearch] = useState('');
  const router = useRouter();

  if (typeof window !== 'undefined' && !localStorage.getItem('gymbros_admin')) {
    return (
      <main className="container" style={{ maxWidth: 720 }}>
        <h1 className="page-title">Доступ лише для адміністраторів</h1>
        <Link href="/admin" className="btn ghost">Увійти як адміністратор</Link>
      </main>
    );
  }

  const rows = ADMIN_USERS.filter((u) => {
    const q = search.toLowerCase();
    return !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <main className="container" style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <h1 className="page-title">Користувачі</h1>
        <span className="chip">Адмін-панель · демо</span>
      </div>
      <p className="page-sub">Модерація: пошук, перегляд, блокування.</p>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Пошук за імʼям або email…"
        style={{ width: '100%', border: '1px solid var(--ring)', borderRadius: 12, padding: '10px 12px', marginBottom: 16 }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((u) => (
          <button
            key={u.id}
            onClick={() => router.push(`/admin/users/${u.id}`)}
            className="card"
            style={{ textAlign: 'left', cursor: 'pointer', width: '100%' }}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px' }}>
                <div style={{ fontWeight: 800 }}>{u.name}</div>
                <div className="prev">{u.email}</div>
              </div>
              <span className="chip" style={{ background: u.status === 'BLOCKED' ? '#fecaca' : '#dcfce7' }}>
                {u.status === 'BLOCKED' ? '● У блоці' : 'Активний'}
              </span>
              <span className="chip">{LEVEL_LABEL[u.level]} · {GOAL_LABEL[u.goal]}</span>
              <span className="chip">{u.reports > 0 ? `⚠ ${u.reports} репортів` : 'без репортів'}</span>
            </div>
          </button>
        ))}
      </div>
    </main>
  );
}
