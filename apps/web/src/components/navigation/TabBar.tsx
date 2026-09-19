type Tab = 'matching' | 'requests' | 'matches' | 'profile';

const TABS: Array<{ key: Tab; label: string; icon: string }> = [
  { key: 'matching', label: 'Пошук', icon: '🔍' },
  { key: 'requests', label: 'Запити', icon: '✉️' },
  { key: 'matches', label: 'Матчі', icon: '💬' },
  { key: 'profile', label: 'Профіль', icon: '👤' },
];

interface TabBarProps {
  tab: Tab;
  setTab: (t: Tab) => void;
}

export function TabBar({ tab, setTab }: TabBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex bg-card border-t border-border pb-6 pt-2 md:hidden">
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => setTab(t.key)}
          className="flex-1 flex flex-col items-center gap-0.5 py-1"
        >
          <span className="text-[22px]">{t.icon}</span>
          <span className={`text-[11px] ${tab === t.key ? 'text-accent' : 'text-muted'}`}>
            {t.label}
          </span>
        </button>
      ))}
    </div>
  );
}
