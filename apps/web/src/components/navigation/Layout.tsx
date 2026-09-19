import type { ReactNode } from 'react';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { TabBar } from './TabBar';
import { Sidebar } from './Sidebar';

type Tab = 'matching' | 'requests' | 'matches' | 'profile';

interface LayoutProps {
  children: ReactNode;
  currentTab: Tab;
  onTabChange: (t: Tab) => void;
}

export function Layout({ children, currentTab, onTabChange }: LayoutProps) {
  const { isMobile } = useBreakpoint();

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      {!isMobile && <Sidebar tab={currentTab} setTab={onTabChange} />}
      <main className={`flex-1 overflow-y-auto ${isMobile ? 'pb-20' : ''}`}>
        {children}
      </main>
      {isMobile && <TabBar tab={currentTab} setTab={onTabChange} />}
    </div>
  );
}
