'use client';

import { useState } from 'react';
import Link from 'next/link';
import { GYMS, GOAL_LABEL, LEVEL_LABEL, previewCards, type Goal, type Level } from '../../lib/mock';
import PartnerCard from '../../components/PartnerCard';

const GOALS: Goal[] = ['MASS', 'CUT', 'STRENGTH', 'ENDURANCE', 'GENERAL'];
const LEVELS: Level[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const SCHEDULES = ['ранок', 'обід', 'вечір після 18:00', 'будь-який'];
const TITLES = ['Ваша ціль', 'Ваш рівень', 'Зручний графік', 'Ваш зал'];

type Step = 0 | 1 | 2 | 3;

export default function Onboarding() {
  const [step, setStep] = useState<Step>(0);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [schedule, setSchedule] = useState('');
  const [gymId, setGymId] = useState('');
  const [done, setDone] = useState(false);

  const canNext =
    step === 0 ? !!goal : step === 1 ? !!level : step === 2 ? !!schedule : !!gymId;

  // Each step offers { value, label } options.
  const options: Array<{ value: string; label: string }> =
    step === 0
      ? GOALS.map((g) => ({ value: g, label: GOAL_LABEL[g] }))
      : step === 1
      ? LEVELS.map((l) => ({ value: l, label: LEVEL_LABEL[l] }))
      : step === 2
      ? SCHEDULES.map((s) => ({ value: s, label: s }))
      : GYMS.map((g) => ({ value: g.id, label: g.name }));

  const selected = step === 0 ? goal : step === 1 ? level : step === 2 ? schedule : gymId;

  function pick(value: string) {
    if (step === 0) setGoal(value as Goal);
    else if (step === 1) setLevel(value as Level);
    else if (step === 2) setSchedule(value);
    else setGymId(value);
  }

  const cards = done
    ? previewCards({ goal: goal ?? undefined, level: level ?? undefined, gymId: gymId || undefined })
    : [];

  return (
    <main className="container">
      <h1 className="page-title">Створимо ваш профіль</h1>
      <p className="page-sub">За 4 кроки знайдемо партнерів, які вам підходять.</p>

      {!done ? (
        <div className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
          <div className="step-dots">
            {[0, 1, 2, 3].map((s) => <span key={s} className={s <= step ? 'on' : ''} />)}
          </div>
          <h2 style={{ margin: '0 0 18px' }}>{TITLES[step]}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {options.map((o) => (
              <button
                key={o.value}
                className="chip"
                onClick={() => pick(o.value)}
                style={{
                  cursor: 'pointer',
                  border: selected === o.value ? '2px solid var(--brand)' : '1px solid var(--ring)',
                  background: selected === o.value ? '#dcfce7' : '#eef2f7',
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 22 }}>
            <button className="btn ghost" onClick={() => setStep((step - 1) as Step)} disabled={step === 0}>
              Назад
            </button>
            {step < 3 ? (
              <button className="btn" disabled={!canNext} onClick={() => setStep((step + 1) as Step)}>
                Далі
              </button>
            ) : (
              <button className="btn" disabled={!canNext} onClick={() => setDone(true)}>
                Показати партнерів 🔎
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <h2 className="page-title">Ось хто вам підходить</h2>
          <p className="page-sub">Анонімне превʼю — оберіть і запросіть у пару (демо на статичних даних).</p>
          {cards.length === 0 ? (
            <p>За цими фільтрами нікого не знайдено. Змініть параметри.</p>
          ) : (
            <div className="grid">
              {cards.map((c, i) => (
                <PartnerCard key={i} p={c} />
              ))}
            </div>
          )}
          <div style={{ marginTop: 26, display: 'flex', gap: 12 }}>
            <Link href="/matches" className="btn">Переглянути всіх партнерів</Link>
            <button className="btn ghost" onClick={() => setDone(false)}>Змінити параметри</button>
          </div>
        </>
      )}
    </main>
  );
}
