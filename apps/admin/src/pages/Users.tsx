import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, type AdminUserRow, type Paged } from '../api';

const STATUS_LABEL: Record<string, string> = { ACTIVE: 'Активний', BLOCKED: 'Заблокований' };

export function UsersPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<AdminUserRow> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await adminApi.listUsers({ search: search || undefined, status: status || undefined, page }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка завантаження');
    }
  }, [search, status, page]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250); // debounce live search
    return () => clearTimeout(t);
  }, [load]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <div className="toolbar">
        <input
          className="search"
          placeholder="Пошук за email або імʼям…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Усі статуси</option>
          <option value="ACTIVE">Активні</option>
          <option value="BLOCKED">Заблоковані</option>
        </select>
      </div>

      {error && <div className="error">{error}</div>}

      <table className="users">
        <thead>
          <tr>
            <th>Користувач</th>
            <th>Рівень</th>
            <th>Ціль</th>
            <th>Зал</th>
            <th>Скарги</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          {data?.items.map((u) => (
            <tr key={u.id} className={u.status === 'BLOCKED' ? 'blocked' : ''}>
              <td>
                <Link to={`/users/${u.id}`}>
                  <strong>{u.name}</strong>
                  <br />
                  <span className="muted">{u.email}</span>
                </Link>
              </td>
              <td>{u.level ?? '—'}</td>
              <td>{u.goal ?? '—'}</td>
              <td>{u.gymName ?? '—'}</td>
              <td>{u.reportsReceivedCount > 0 ? <span className="pill warn">{u.reportsReceivedCount}</span> : '0'}</td>
              <td>
                <span className={`pill ${u.status === 'BLOCKED' ? 'danger' : 'ok'}`}>{STATUS_LABEL[u.status] ?? u.status}</span>
              </td>
            </tr>
          ))}
          {data && data.items.length === 0 && (
            <tr>
              <td colSpan={6} className="muted center-cell">
                Нікого не знайдено
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {data && pages > 1 && (
        <div className="pager">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ← Назад
          </button>
          <span>
            {page} / {pages} (усього {data.total})
          </span>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Далі →
          </button>
        </div>
      )}
    </div>
  );
}
