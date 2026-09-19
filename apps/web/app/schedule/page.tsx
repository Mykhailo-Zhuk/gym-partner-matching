'use client';

import { useState } from 'react';
import { SCHEDULE, WORKOUT_TYPES } from '@/lib/mock';

const DAYS = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', 'Пʼятниця', 'Субота', 'Неділя'];

export default function Schedule() {
  const [slots, setSlots] = useState(SCHEDULE);
  const [day, setDay] = useState(DAYS[0]);
  const [time, setTime] = useState('19:00');
  const [toast, setToast] = useState<string | null>(null);

  function add() {
    setSlots((s) => [...s, { id: 'local-' + Date.now(), day, time, partnerName: 'Ваш партнер' }]);
    setToast(`Заплановано: ${day} о ${time}`);
    setTimeout(() => setToast(null), 2000);
  }

  return (
    <main className="container" style={{ maxWidth: 720 }}>
      <h1 className="page-title">Розклад</h1>
      <p className="page-sub">Спільні тренування з партнером.</p>

      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '1 1 160px', marginBottom: 0 }}>
            <label>День</label>
            <select value={day} onChange={(e) => setDay(e.target.value)}>
              {DAYS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 120px', marginBottom: 0 }}>
            <label>Час</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <button className="btn" onClick={add}>Додати тренування</button>
        </div>
      </div>

      {slots.length === 0 ? (
        <p className="card">Розклад порожній.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {slots.map((s) => (
            <div key={s.id} className="card chat-row">
              <div style={{ fontWeight: 800, minWidth: 130 }}>{s.day}</div>
              <div className="chip">{s.time}</div>
              <div style={{ flex: 1, color: 'var(--muted)' }}>{s.partnerName}</div>
            </div>
          ))}
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
