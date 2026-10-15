import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import clsx from 'clsx';

const control =
  'w-full rounded-md border bg-canvas2 px-3 text-sm text-fg placeholder:text-faint transition-colors duration-150 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-50';

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
}

export type InputProps = InputHTMLAttributes<HTMLInputElement> & FieldShellProps & { trailing?: ReactNode };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, id, trailing, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  const descId = `${inputId}-desc`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-fg">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? descId : undefined}
          className={clsx(control, 'h-10', trailing && 'pr-11', error ? 'border-expense' : 'border-line', className)}
          {...rest}
        />
        {trailing && <div className="absolute inset-y-0 right-0 flex items-center pr-1">{trailing}</div>}
      </div>
      {(error || hint) && (
        <p id={descId} role={error ? 'alert' : undefined} className={clsx('text-xs', error ? 'text-expense' : 'text-faint')}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
});

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & FieldShellProps;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, className, id, children, ...rest },
  ref,
) {
  const auto = useId();
  const selectId = id ?? auto;
  const descId = `${selectId}-desc`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={selectId} className="block text-sm font-medium text-fg">
        {label}
      </label>
      <select
        ref={ref}
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? descId : undefined}
        className={clsx(control, 'h-10', error ? 'border-expense' : 'border-line', className)}
        {...rest}
      >
        {children}
      </select>
      {(error || hint) && (
        <p id={descId} role={error ? 'alert' : undefined} className={clsx('text-xs', error ? 'text-expense' : 'text-faint')}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
});
