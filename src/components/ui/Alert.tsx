import type { ReactNode } from 'react';
import clsx from 'clsx';

const tones = {
  error: 'border-expense/40 bg-expense/10 text-expense',
  success: 'border-income/40 bg-income/10 text-income',
  info: 'border-line2 bg-surface text-mute',
} as const;

export function Alert({ tone = 'info', children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={clsx('rounded-md border px-3.5 py-3 text-sm', tones[tone])}>
      {children}
    </div>
  );
}
