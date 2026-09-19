'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/matches', label: 'Пошук' },
  { href: '/requests', label: 'Запити' },
  { href: '/pairs', label: 'Пари' },
  { href: '/chat', label: 'Чат' },
  { href: '/dashboard', label: 'Дашборд' },
  { href: '/profile', label: 'Профіль' },
  { href: '/admin', label: 'Адмінка' },
];

export default function Navbar() {
  const path = usePathname();
  return (
    <header className="nav">
      <div className="nav-inner">
        <Link href="/" className="brand">
          <span className="dot">GB</span> GymBrosUK
        </Link>
        <nav className="nav-links">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={(path ?? '').startsWith(l.href) ? 'active' : ''}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
