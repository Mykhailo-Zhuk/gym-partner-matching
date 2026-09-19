import type { ReactNode, CSSProperties } from 'react';

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  style?: CSSProperties;
  className?: string;
}

export function Card({ children, onPress, style, className = '' }: CardProps) {
  const card = (
    <div
      className={`bg-card rounded-xl p-4 mb-3 border border-border ${className}`}
      style={style}
    >
      {children}
    </div>
  );

  if (onPress) {
    return (
      <button type="button" onClick={onPress} className="w-full text-left">
        {card}
      </button>
    );
  }

  return card;
}
