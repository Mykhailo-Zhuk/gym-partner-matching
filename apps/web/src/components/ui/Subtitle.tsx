import type { ReactNode } from 'react';

interface SubtitleProps {
  children: ReactNode;
}

export function Subtitle({ children }: SubtitleProps) {
  return <p className="text-muted text-[15px] mb-6">{children}</p>;
}
