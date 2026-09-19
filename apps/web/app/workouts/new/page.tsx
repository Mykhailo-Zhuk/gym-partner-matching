'use client';

import { useState } from 'react';
import { WORKOUT_TYPES, DASHBOARD } from '@/lib/mock';

export default function WorkoutForm() {
  const [type, setType] = useState(WORKOUT_TYPES[0]);
  const [sets, setSets] = useState(4);
  const [reps, setReps] = useState(10);
  const [weight, setWeight] = useState(80);
  const [saved, setSaved] = useState(false);

  const kg = sets * (reps || 1) * weight;

  function save() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <main className="container" style={{ maxWidth: 520 }}>
      <h1 className="page-title">Додати тренування</h1>
      <p className="page-sub">Запишіть підхід — він зʼявиться у спільному дашборді.</p>

      <div className="card">
        <div className="field">
          <label>Тип</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {WORKOUT_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div className="field">
            <label>Підходи</label>
            <input type="number" min={1} value={sets} onChange={(e) => setSets(+e.target.value)} />
          </div>
          <div className="field">
            <label>Повтори</label>
            <input type="number" min={1} value={reps} onChange={(e) => setReps(+e.target.value)} />
          </div>
          <div className="field">
            <label>Вага, кг</label>
            <input type="number" min={0} value={weight} onChange={(e) => setWeight(+e.target.value)} />
          </div>
        </div>
        <div className="stat" style={{ marginBottom: 16 }}>
          <div className="v">{kg} кг</div>
          <div className="l">Тоннаж цього підходу</div>
        </div>
        <button className="btn" style={{ width: '100%' }} onClick={save}>
          {saved ? 'Збережено ✓' : 'Зберегти тренування'}
        </button>
      </div>
    </main>
  );
}
