import type { ReactNode, CSSProperties } from 'react';

interface TitleProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export function Title({ children, style, className = '' }: TitleProps) {
  return (
    <h1 className={`text-text text-[26px] font-bold mb-[6px] ${className}`} style={style}>
      {children}
    </h1>
  );
}
