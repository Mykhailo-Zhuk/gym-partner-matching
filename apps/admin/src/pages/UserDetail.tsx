import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adminApi, type AdminUserCard, type ReportItem } from '../api';

function fmt(dt: string) {
  return new Date(dt).toLocaleString('uk-UA', { dateStyle: 'medium', timeStyle: 'short' });
}

function ReportList({ title, items }: { title: string; items: ReportItem[] }) {
  return (
    <section>
      <h3>
        {title} <span className="pill">{items.length}</span>
      </h3>
      {items.length === 0 && <p className="muted">Порожньо</p>}
      <ul className="report-list">
        {items.map((r) => (
          <li key={r.id} className="card">
            <div className="row">
              <strong>{r.reason}</strong>
              <span className="muted">{fmt(r.createdAt)}</span>
            </div>
            {r.details && <p>{r.details}</p>}
            <p className="muted small">
              від {r.reporter.name} ({r.reporter.email})
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [card, setCard] = useState<AdminUserCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [confirmAction, setConfirmAction] = useState<'block' | 'unblock' | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setCard(await adminApi.getUser(id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка завантаження');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act() {
    if (!id || !confirmAction) return;
    setBusy(true);
    setError(null);
    try {
      if (confirmAction === 'block') {
        const res = await adminApi.block(id, reason.trim());
        setNotice(`Заблоковано. Сповіщено активних партнерів: ${res.notifiedMatchPartners}`);
      } else {
        await adminApi.unblock(id);
        setNotice('Користувача розблоковано, йому надіслано сповіщення.');
      }
      setConfirmAction(null);
      setReason('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вдалося виконати дію');
    } finally {
      setBusy(false);
    }
  }

  if (!card) {
    return <div>{error ? <div className="error">{error}</div> : <p className="muted">Завантаження…</p>}</div>;
  }

  const p = card.profile;
  const isBlocked = p.status === 'BLOCKED';

  return (
    <div>
      <Link to="/" className="muted">
        ← До списку користувачів
      </Link>

      <div className="card profile">
        <div className="row">
          <div>
            <h2>{p.name}</h2>
            <p className="muted">{p.email}</p>
          </div>
          <span className={`pill ${isBlocked ? 'danger' : 'ok'}`}>{isBlocked ? 'Заблокований' : 'Активний'}</span>
        </div>
        <dl className="facts">
          <div>
            <dt>Рівень</dt>
            <dd>{p.level ?? '—'}</dd>
          </div>
          <div>
            <dt>Ціль</dt>
            <dd>{p.goal ?? '—'}</dd>
          </div>
          <div>
            <dt>Зал</dt>
            <dd>{p.gymName ?? '—'}</dd>
          </div>
          <div>
            <dt>Реєстрація</dt>
            <dd>{fmt(p.createdAt)}</dd>
          </div>
          {isBlocked && p.blockedReason && (
            <div>
              <dt>Причина блоку</dt>
              <dd>{p.blockedReason}</dd>
            </div>
          )}
        </dl>

        {isBlocked ? (
          <button className="btn-ok" onClick={() => setConfirmAction('unblock')}>
            Розблокувати
          </button>
        ) : (
          <button className="btn-danger" onClick={() => setConfirmAction('block')}>
            Заблокувати
          </button>
        )}
        {notice && <p className="notice">{notice}</p>}
        {error && <p className="error">{error}</p>}
      </div>

      <ReportList title="Скарги на користувача" items={card.reportsReceived} />
      <ReportList title="Скарги від користувача" items={card.reportsFiled} />

      <section>
        <h3>
          Історія пар <span className="pill">{card.matches.length}</span>
        </h3>
        {card.matches.length === 0 && <p className="muted">Пар ще не було</p>}
        <ul className="report-list">
          {card.matches.map((m) => (
            <li key={m.id} className="card row">
              <strong>{m.partner.name}</strong>
              <span className="muted">
                {m.status} · {fmt(m.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {confirmAction && (
        <div className="modal-backdrop" onClick={() => setConfirmAction(null)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            {confirmAction === 'block' ? (
              <>
                <h3>Заблокувати {p.name}?</h3>
                <p className="muted">
                  Користувач миттєво втратить доступ до всіх endpoint, сесії будуть скасовані, а партнери з активними
                  парами отримають сповіщення. Дія запишеться в audit log.
                </p>
                <label>
                  Причина (обовʼязково)
                  <textarea
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Напр.: недоречні повідомлення"
                    autoFocus
                  />
                </label>
                <div className="row right">
                  <button onClick={() => setConfirmAction(null)}>Скасувати</button>
                  <button className="btn-danger" disabled={busy || reason.trim().length < 3} onClick={() => void act()}>
                    {busy ? 'Блокую…' : 'Підтвердити блокування'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>Розблокувати {p.name}?</h3>
                <p className="muted">Доступ буде відновлено, користувач отримає push-сповіщення. Дія запишеться в audit log.</p>
                <div className="row right">
                  <button onClick={() => setConfirmAction(null)}>Скасувати</button>
                  <button className="btn-ok" disabled={busy} onClick={() => void act()}>
                    {busy ? 'Розблоковую…' : 'Розблокувати'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
