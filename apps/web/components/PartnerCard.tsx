import type { Goal, Level } from '../lib/mock';
import { GOAL_LABEL, LEVEL_LABEL } from '../lib/mock';

export interface PartnerView {
  id?: string;
  firstName?: string;
  name?: string;
  avatar: string;
  level: Level;
  goal: Goal;
  schedule: string;
  gymName?: string | null;
  ratingAverage: number | null;
  ratingCount: number;
}

export default function PartnerCard({
  p,
  action,
}: {
  p: PartnerView;
  action?: React.ReactNode;
}) {
  const firstName = p.firstName ?? p.name?.split(' ')[0] ?? 'Користувач';
  return (
    <div className="card partner-card">
      <div className="partner-avatar">{p.avatar}</div>
      <div className="partner-name">{firstName}</div>
      <div className="partner-meta">
        <div>{LEVEL_LABEL[p.level]} · {GOAL_LABEL[p.goal]}</div>
        <div>🗓 {p.schedule || '—'}</div>
        {p.gymName ? <div>🏟 {p.gymName}</div> : null}
        <div className="rating">
          ★ {p.ratingAverage ?? '—'} <span style={{ color: 'var(--muted)', fontWeight: 600 }}>({p.ratingCount})</span>
        </div>
      </div>
      {action}
    </div>
  );
}
