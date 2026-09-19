import { BADGES, DASHBOARD, THIS_WEEK } from '../../lib/mock';

export default function Dashboard() {
  const stats = [
    { v: DASHBOARD.workoutsThisWeek, l: 'Тренувань цього тижня' },
    { v: `${(DASHBOARD.totalKg / 1000).toFixed(1)}т`, l: 'Загальний тоннаж' },
    { v: `${DASHBOARD.streakWeeks}`, l: 'Тижнів поспіль' },
    { v: DASHBOARD.withPartner, l: 'Спільних тренувань' },
  ];

  return (
    <main className="container">
      <h1 className="page-title">Спільний дашборд</h1>
      <p className="page-sub">Ваша активність із партнером (демо-дані).</p>

      <div className="stat-grid">
        {stats.map((s) => (
          <div key={s.l} className="stat">
            <div className="v">{s.v}</div>
            <div className="l">{s.l}</div>
          </div>
        ))}
      </div>

      <h2 className="page-title" style={{ fontSize: 20 }}>Тренування цього тижня</h2>
      <div className="card" style={{ marginBottom: 24, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f8fafc', color: 'var(--muted)' }}>
              <th style={{ textAlign: 'left', padding: '10px 16px' }}>День</th>
              <th style={{ textAlign: 'left', padding: '10px 16px' }}>Тип</th>
              <th style={{ textAlign: 'right', padding: '10px 16px' }}>Обʼєм</th>
              <th style={{ textAlign: 'right', padding: '10px 16px' }}>Тоннаж</th>
            </tr>
          </thead>
          <tbody>
            {THIS_WEEK.map((w) => (
              <tr key={w.date} style={{ borderTop: '1px solid var(--ring)' }}>
                <td style={{ padding: '10px 16px', fontWeight: 700 }}>{w.date}</td>
                <td style={{ padding: '10px 16px' }}>{w.type}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                  {w.sets}×{w.reps} · {w.weightKg}kg
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>{w.kg}kg</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="page-title" style={{ fontSize: 20 }}>Досягнення</h2>
      <div className="badge-grid">
        {BADGES.map((b) => (
          <div key={b.slug} className={`badge ${b.earned ? '' : 'locked'}`}>
            <div className="ic">{b.icon}</div>
            <div style={{ fontWeight: 800 }}>{b.title}</div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>{b.description}</div>
            {!b.earned && <div style={{ fontSize: 12, marginTop: 6, color: 'var(--muted)' }}>🔒 Ще не отримано</div>}
          </div>
        ))}
      </div>
    </main>
  );
}
