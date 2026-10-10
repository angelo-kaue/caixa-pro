import { forwardRef, type ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 select-none whitespace-nowrap';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-canvas hover:bg-brand-dark active:bg-brand-dark',
  secondary: 'border border-line bg-surface text-fg hover:border-line2 hover:bg-surface2',
  ghost: 'text-mute hover:bg-surface hover:text-fg',
  danger: 'border border-expense/40 text-expense hover:bg-expense/10',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

/** Use em <Link> ou <a> para obter o mesmo visual de botão. */
export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra?: string): string {
  return clsx(base, variants[variant], sizes[size], extra);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, size, className)}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
});
