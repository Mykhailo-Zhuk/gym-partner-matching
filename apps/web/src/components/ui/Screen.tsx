import type { ReactNode, CSSProperties } from 'react';
import { Title } from './Title';
import { Subtitle } from './Subtitle';
import { Card } from './Card';
import { Loading } from './Loading';
import { Button } from './Button';

interface ScreenProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export function Screen({ children, style, className = '' }: ScreenProps) {
  return (
    <div
      className={`min-h-full bg-bg px-5 pt-[60px] pb-6 ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

export { Title, Subtitle, Card, Loading, Button };
