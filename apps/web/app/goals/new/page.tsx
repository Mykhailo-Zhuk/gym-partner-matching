'use client';

import { useState } from 'react';
import { GOAL_METRICS } from '@/lib/mock';

const DUE = ['2 тижні', '1 місяць', '2 місяці'];

export default function GoalForm() {
  const [title, setTitle] = useState('Спільна мета');
  const [metric, setMetric] = useState(GOAL_METRICS[1]);
  const [target, setTarget] = useState(10000);
  const [due, setDue] = useState('1 місяць');
  const [saved, setSaved] = useState(false);

  function save() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <main className="container" style={{ maxWidth: 520 }}>
      <h1 className="page-title">Спільна мета</h1>
      <p className="page-sub">Поставте ціль разом із партнером — партнер підтвердить.</p>

      <div className="card">
        <div className="field">
          <label>Назва</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>Метрика</label>
          <select value={metric} onChange={(e) => setMetric(e.target.value)}>
            {GOAL_METRICS.map((m) => (
              <option key={m} value={m}>{m === 'TOTAL_KG' ? 'Загальний тоннаж, кг' : 'Кількість тренувань'}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Цільове значення</label>
          <input type="number" value={target} onChange={(e) => setTarget(+e.target.value)} />
        </div>
        <div className="field">
          <label>Дедлайн</label>
          <select value={due} onChange={(e) => setDue(e.target.value)}>
            {DUE.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <button className="btn" style={{ width: '100%' }} onClick={save}>
          {saved ? 'Ціль створено 🎯' : 'Створити ціль'}
        </button>
      </div>
    </main>
  );
}
