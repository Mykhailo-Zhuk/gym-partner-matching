'use client';

import { useState } from 'react';
import { MY_PAIRS } from '@/lib/mock';

const LABELS = ['Пунктуальність', 'Комунікація', 'Спотинг'];

export default function RatingForm() {
  const [pair, setPair] = useState(MY_PAIRS[0]?.id ?? '');
  const [scores, setScores] = useState<number[]>([5, 5, 5]);
  const [comment, setComment] = useState('');
  const [saved, setSaved] = useState(false);

  const partner = MY_PAIRS.find((m) => m.id === pair);

  function submit() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <main className="container" style={{ maxWidth: 520 }}>
      <h1 className="page-title">Оцінити партнера</h1>
      <p className="page-sub">Після спільного тренування оцініть напарника (демо).</p>

      <div className="card">
        <div className="field">
          <label>Партнер</label>
          <select value={pair} onChange={(e) => setPair(e.target.value)}>
            {MY_PAIRS.map((m) => (
              <option key={m.id} value={m.id}>{m.partnerAvatar} {m.partnerName}</option>
            ))}
          </select>
        </div>

        {LABELS.map((label, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontWeight: 700 }}>{label}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  className="chip"
                  onClick={() => setScores((s) => s.map((v, idx) => (idx === i ? n : v)))}
                  style={{ cursor: 'pointer', fontSize: 16, background: scores[i] >= n ? '#fde68a' : '#eef2f7' }}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="field">
          <label>Коментар</label>
          <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder={`Що сподобалось у ${partner ? partner.partnerName.split(' ')[0] : 'партнера'}?`} />
        </div>

        <button className="btn" style={{ width: '100%' }} onClick={submit}>
          {saved ? 'Дякуємо за оцінку ⭐' : 'Надіслати оцінку'}
        </button>
      </div>
    </main>
  );
}
