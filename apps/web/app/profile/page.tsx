'use client';

import { useEffect, useState } from 'react';
import { GYMS, GOAL_LABEL, LEVEL_LABEL, ME, type Goal, type Level } from '../../lib/mock';

interface ProfileState {
  name: string;
  avatar: string;
  level: Level;
  goal: Goal;
  schedule: string;
  gymId: string;
  bio: string;
}

const STORAGE = 'gymbros_profile';

export default function Profile() {
  const [p, setP] = useState<ProfileState>(ME);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) setP({ ...ME, ...JSON.parse(raw) });
    } catch {}
  }, []);

  function update<K extends keyof ProfileState>(k: K, v: ProfileState[K]) {
    setP((prev) => ({ ...prev, [k]: v }));
  }

  function save() {
    localStorage.setItem(STORAGE, JSON.stringify(p));
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  const AVATARS = ['🙂', '🧔', '💪', '🏋️', '🔥', '🤺', '🧘‍♀️', '⚡'];

  return (
    <main className="container" style={{ maxWidth: 720 }}>
      <h1 className="page-title">Ваш профіль</h1>
      <p className="page-sub">Звідси керуєте профілем для мэтчингу (демо зберігається в браузері).</p>

      <div className="card">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          {AVATARS.map((a) => (
            <button
              key={a}
              onClick={() => update('avatar', a)}
              className="chip"
              style={{
                cursor: 'pointer',
                fontSize: 22,
                border: p.avatar === a ? '2px solid var(--brand)' : '1px solid var(--ring)',
              }}
            >
              {a}
            </button>
          ))}
        </div>

        <div className="field">
          <label>Імʼя</label>
          <input value={p.name} onChange={(e) => update('name', e.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="field">
            <label>Рівень</label>
            <select value={p.level} onChange={(e) => update('level', e.target.value as Level)}>
              {Object.entries(LEVEL_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Ціль</label>
            <select value={p.goal} onChange={(e) => update('goal', e.target.value as Goal)}>
              {Object.entries(GOAL_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Графік</label>
            <input value={p.schedule} onChange={(e) => update('schedule', e.target.value)} />
          </div>
          <div className="field">
            <label>Зал</label>
            <select value={p.gymId} onChange={(e) => update('gymId', e.target.value)}>
              {GYMS.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label>Про себе</label>
          <textarea rows={3} value={p.bio} onChange={(e) => update('bio', e.target.value)} />
        </div>

        <button className="btn" onClick={save}>{saved ? 'Збережено ✓' : 'Зберегти'}</button>
      </div>
    </main>
  );
}
