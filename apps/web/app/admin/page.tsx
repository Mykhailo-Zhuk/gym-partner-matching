'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ADMIN_LOGIN } from '@/lib/mock';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (email !== ADMIN_LOGIN.email || password !== ADMIN_LOGIN.password) {
      setError(`Невірні дані адміністратора. (Демо: ${ADMIN_LOGIN.email} / ${ADMIN_LOGIN.password})`);
      return;
    }
    localStorage.setItem('gymbros_admin', '1');
    router.push('/admin/users');
  }

  return (
    <main className="container" style={{ maxWidth: 400 }}>
      <h1 className="page-title">Адмін-панель</h1>
      <p className="page-sub">Модерація користувачів (демо).</p>
      <div className="card">
        <form onSubmit={submit}>
          <div className="field">
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={ADMIN_LOGIN.email} />
          </div>
          <div className="field">
            <label>Пароль</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {error && <p style={{ color: '#dc2626', margin: '0 0 12px', fontSize: 14 }}>{error}</p>}
          <button className="btn" style={{ width: '100%' }}>Увійти</button>
        </form>
      </div>
    </main>
  );
}
