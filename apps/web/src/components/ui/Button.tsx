import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  title: string;
  kind?: 'primary' | 'ghost';
  disabled?: boolean;
}

export function Button({ title, kind = 'primary', disabled, className = '', ...rest }: ButtonProps) {
  const base =
    'w-full rounded-xl py-[14px] text-center text-[16px] font-semibold transition-opacity mt-3 disabled:opacity-50';
  const primary = 'bg-accent text-white';
  const ghost = 'bg-transparent text-muted';

  return (
    <button
      type="button"
      disabled={disabled}
      className={`${base} ${kind === 'primary' ? primary : ghost} ${className}`}
      {...rest}
    >
      {title}
    </button>
  );
}
