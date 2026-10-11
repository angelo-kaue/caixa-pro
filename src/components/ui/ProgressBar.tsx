import clsx from 'clsx';

interface ProgressBarProps {
  pct: number;
  tone?: 'ok' | 'warning' | 'over';
  label: string;
  className?: string;
}

export function ProgressBar({ pct, tone = 'ok', label, className }: ProgressBarProps) {
  const value = Math.max(0, Math.min(100, pct));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className={clsx('h-1.5 overflow-hidden rounded-full bg-surface2', className)}
    >
      <div className={clsx('h-full rounded-full transition-[width]', tone === 'ok' && 'bg-brand', tone === 'warning' && 'bg-warn', tone === 'over' && 'bg-expense')} style={{ width: `${value}%` }} />
    </div>
  );
}
