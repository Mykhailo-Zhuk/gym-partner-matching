import { GYMS, GOAL_LABEL, LEVEL_LABEL, ME } from '@/lib/mock';

export default function ProfilePreview() {
  const gym = GYMS.find((g) => g.id === ME.gymId);
  return (
    <main className="container" style={{ maxWidth: 420 }}>
      <h1 className="page-title">Превʼю профілю</h1>
      <p className="page-sub">Так вас бачать інші користувачі.</p>

      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 56 }}>{ME.avatar}</div>
        <div className="partner-name" style={{ fontSize: 22, marginTop: 6 }}>{ME.name}</div>
        <div className="partner-meta" style={{ marginTop: 4 }}>
          <div>{LEVEL_LABEL[ME.level]} · {GOAL_LABEL[ME.goal]}</div>
          <div>🗓 {ME.schedule}</div>
          {gym ? <div>🏟 {gym.name}</div> : null}
        </div>
        {ME.bio && <p style={{ margin: '14px 0 0' }}>{ME.bio}</p>}
      </div>
    </main>
  );
}
