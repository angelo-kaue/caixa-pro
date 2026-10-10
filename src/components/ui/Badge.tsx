import type { ReactNode } from 'react';
import clsx from 'clsx';

type Tone = 'neutral' | 'income' | 'expense' | 'warn';

const tones: Record<Tone, string> = {
  neutral: 'border-line text-mute',
  income: 'border-income/30 bg-income/10 text-income',
  expense: 'border-expense/30 bg-expense/10 text-expense',
  warn: 'border-warn/30 bg-warn/10 text-warn',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={clsx('inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-semibold', tones[tone])}>
      {children}
    </span>
  );
}
