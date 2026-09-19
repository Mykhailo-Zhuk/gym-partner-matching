import Link from 'next/link';

export default function Home() {
  const feats = [
    { icon: '🧑‍🤝‍🧑', t: 'Мэтчинг за цілею', d: 'Шукаємо партнера зі схожою ціллю та рівнем — набір маси, схуднення чи сила.' },
    { icon: '⏰', t: 'Зручний графік', d: 'Фільтри за розкладом і залом, щоб ви тренувалися, коли зручно обом.' },
    { icon: '💬', t: 'Чат і нагадування', d: 'Плануйте тренування разом у чаті та не пропускайте спільні підходи.' },
    { icon: '📈', t: 'Спільний дашборд', d: 'Тоннаж, стрік і бейджі — мотивація для обох партнерів.' },
  ];
  return (
    <main className="container">
      <div className="banner">
        <h1>Знайди напарника для тренувань 💪</h1>
        <p>
          GymBrosUK — сервіс пошуку партнера у спортзал. Оберіть ціль, рівень і зал — і ми покажемо,
          з ким вам тренуватися. Один клік, щоб запросити в пару й тренуватися разом.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/onboarding" className="btn">Почати онбординг</Link>
          <Link href="/matches" className="btn ghost" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}>
            Дивитись партнерів
          </Link>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))' }}>
        {feats.map((f) => (
          <div key={f.t} className="feat">
            <div style={{ fontSize: 28 }}>{f.icon}</div>
            <h3>{f.t}</h3>
            <p>{f.d}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
