import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-md border border-line text-brand">
        <Icon size={20} aria-hidden="true" />
      </span>
      <h3 className="text-h3">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-mute">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
