'use client';

import { useState } from 'react';
import { GYMS, GOAL_LABEL, LEVEL_LABEL, searchPartners, type Goal, type Level } from '../../lib/mock';
import PartnerCard from '../../components/PartnerCard';

export default function Matches() {
  const [goal, setGoal] = useState<Goal | ''>('');
  const [level, setLevel] = useState<Level | ''>('');
  const [gymId, setGymId] = useState('');
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const results = searchPartners(
    { goal: goal || undefined, level: level || undefined, gymId: gymId || undefined },
    12,
  );

  function request(id: string, name: string) {
    setRequested((s) => new Set(s).add(id));
    setToast(`Запит надіслано: ${name.split(' ')[0]} 🤝`);
    setTimeout(() => setToast(null), 2200);
  }

  return (
    <main className="container">
      <h1 className="page-title">Партнери для тренувань</h1>
      <p className="page-sub">Знайдіть напарника за ціллю, рівнем, графіком і залом.</p>

      <div className="card" style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '1 1 160px', marginBottom: 0 }}>
            <label>Ціль</label>
            <select value={goal} onChange={(e) => setGoal(e.target.value as Goal | '')}>
              <option value="">Всі</option>
              {Object.entries(GOAL_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 160px', marginBottom: 0 }}>
            <label>Рівень</label>
            <select value={level} onChange={(e) => setLevel(e.target.value as Level | '')}>
              <option value="">Всі</option>
              {Object.entries(LEVEL_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 180px', marginBottom: 0 }}>
            <label>Зал</label>
            <select value={gymId} onChange={(e) => setGymId(e.target.value)}>
              <option value="">Всі зали</option>
              {GYMS.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <button className="btn ghost" onClick={() => { setGoal(''); setLevel(''); setGymId(''); }}>
            Скинути
          </button>
        </div>
      </div>

      <div className="grid">
        {results.length === 0 ? (
          <p>За цими фільтрами нікого не знайдено.</p>
        ) : (
          results.map((p) => (
            <PartnerCard
              key={p.id}
              p={{ ...p, gymName: GYMS.find((g) => g.id === p.gymId)?.name }}
              action={
                <button
                  className="btn"
                  style={{ marginTop: 'auto' }}
                  disabled={requested.has(p.id)}
                  onClick={() => request(p.id, p.name)}
                >
                  {requested.has(p.id) ? 'Записано ✓' : 'Запросити в пару'}
                </button>
              }
            />
          ))
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
