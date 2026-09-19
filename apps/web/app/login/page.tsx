'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const DEMO_ACCOUNTS = [
  { email: 'oleksii@gymbros.dev', password: 'password123', name: 'Олексій', avatar: '🧔' },
  { email: 'mariia@gymbros.dev', password: 'password123', name: 'Марія', avatar: '🧘‍♀️' },
  { email: 'andrii@gymbros.dev', password: 'password123', name: 'Андрій', avatar: '🏃' },
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const acc = DEMO_ACCOUNTS.find((a) => a.email === email && a.password === password);
    if (!acc) {
      setError('Невірний email або пароль (спробуйте демо-акаунт).');
      return;
    }
    localStorage.setItem('gymbros_user', JSON.stringify(acc));
    router.push('/matches');
  }

  return (
    <main className="container" style={{ maxWidth: 420 }}>
      <h1 className="page-title">Вхід</h1>
      <p className="page-sub">Демо-авторизація (мок). Оберіть акаунт нижче або введіть дані.</p>
      <div className="card">
        <form onSubmit={submit}>
          <div className="field">
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gymbros.dev" />
          </div>
          <div className="field">
            <label>Пароль</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {error && <p style={{ color: '#dc2626', margin: '0 0 12px' }}>{error}</p>}
          <button className="btn" style={{ width: '100%' }}>Увійти</button>
        </form>
        <div style={{ margin: '18px 0 6px', color: 'var(--muted)', fontSize: 14 }}>Швидкий вхід (демо):</div>
        {DEMO_ACCOUNTS.map((a) => (
          <button
            key={a.email}
            className="chip"
            style={{ cursor: 'pointer', marginRight: 8 }}
            onClick={() => { setEmail(a.email); setPassword(a.password); }}
          >
            {a.avatar} {a.name}
          </button>
        ))}
      </div>
      <p style={{ marginTop: 16 }}>
        <Link href="/onboarding" className="btn ghost">Новий користувач — онбординг</Link>
      </p>
    </main>
  );
}
