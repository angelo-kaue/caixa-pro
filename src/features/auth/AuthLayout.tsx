import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/ui/Logo';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col px-5 py-8">
      <Link to="/" aria-label="CaixaPro, página inicial" className="self-start">
        <Logo />
      </Link>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
        <h1 className="text-h1">{title}</h1>
        {subtitle && <p className="mt-2 text-mute">{subtitle}</p>}
        <div className="mt-8">{children}</div>
        {footer && <div className="mt-6 text-sm text-mute">{footer}</div>}
      </main>
    </div>
  );
}
