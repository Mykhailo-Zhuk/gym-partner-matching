type Tab = 'matching' | 'requests' | 'matches' | 'profile';

const TABS: Array<{ key: Tab; label: string; icon: string }> = [
  { key: 'matching', label: 'Пошук', icon: '🔍' },
  { key: 'requests', label: 'Запити', icon: '✉️' },
  { key: 'matches', label: 'Матчі', icon: '💬' },
  { key: 'profile', label: 'Профіль', icon: '👤' },
];

interface SidebarProps {
  tab: Tab;
  setTab: (t: Tab) => void;
}

export function Sidebar({ tab, setTab }: SidebarProps) {
  return (
    <aside className="hidden md:flex flex-col w-56 bg-card border-r border-border min-h-screen pt-6 px-4 shrink-0">
      <div className="mb-8 px-2">
        <span className="text-accent text-xl font-bold">🏋️ GymBros</span>
      </div>
      <nav className="flex flex-col gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
              tab === t.key
                ? 'bg-accent/10 text-accent'
                : 'text-muted hover:text-text hover:bg-border/30'
            }`}
          >
            <span className="text-[20px]">{t.icon}</span>
            <span className="text-[15px] font-medium">{t.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
