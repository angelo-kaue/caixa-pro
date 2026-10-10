import clsx from 'clsx';
import { formatCentsToBRL } from '@/domain/money';

interface MoneyProps {
  cents: number;
  /** 'auto' colore pelo sinal; 'income'/'expense' forçam o tom. */
  tone?: 'auto' | 'income' | 'expense' | 'neutral';
  className?: string;
}

export function Money({ cents, tone = 'neutral', className }: MoneyProps) {
  const resolved = tone === 'auto' ? (cents > 0 ? 'income' : cents < 0 ? 'expense' : 'neutral') : tone;
  return (
    <span
      className={clsx(
        'num font-semibold',
        resolved === 'income' && 'text-income',
        resolved === 'expense' && 'text-expense',
        className,
      )}
    >
      {formatCentsToBRL(cents)}
    </span>
  );
}
