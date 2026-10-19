import { useState } from 'react';
import { BarChart3, FileText, LayoutDashboard, List, Target, UserRound } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import clsx from 'clsx';
import { PLANS } from '@/config/plans';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { useAuth } from '@/features/auth/AuthProvider';
import { QuickEntry } from '@/features/transactions/QuickEntry';
import { QuickEntryFab } from './QuickEntryFab';
import { useWorkspace } from '@/features/workspace/WorkspaceProvider';

const baseNav = [
  { to: '/app', label: 'Resumo', icon: LayoutDashboard, end: true },
  { to: '/app/lancamentos', label: 'Lançamentos', icon: List, end: false },
  { to: '/app/planejamento', label: 'Planejamento', icon: Target, end: false },
] as const;
const billsNav = { to: '/app/contas', label: 'Contas', icon: FileText, end: false } as const;
const reportsNav = { to: '/app/relatorios', label: 'Relatórios', icon: BarChart3, end: false } as const;

export function AppLayout() {
  const { workspace, plan } = useWorkspace();
  const { signOut } = useAuth();
  const [leaving, setLeaving] = useState(false);
  const nav = workspace?.type === 'business' ? [...baseNav, billsNav, reportsNav] : [...baseNav, reportsNav];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 backdrop-blur-sm" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Logo size={24} />
            <nav aria-label="Principal" className="hidden items-center gap-1 sm:flex">
              {nav.map(({ to, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    clsx('rounded-md px-3 py-1.5 text-sm font-semibold transition-colors', isActive ? 'bg-surface text-fg' : 'text-mute hover:text-fg')
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-[12rem] truncate text-sm text-mute sm:inline">{workspace?.name}</span>
            <Link to="/app/plano" aria-label={`Plano ${PLANS[plan].name}: ver plano e cobrança`}>
              <Badge>{PLANS[plan].name}</Badge>
            </Link>
            <Link to="/app/conta" aria-label="Minha conta" className="rounded-md p-2 text-mute hover:bg-surface hover:text-fg">
              <UserRound size={18} />
            </Link>
            <Button
              variant="ghost"
              size="sm"
              loading={leaving}
              onClick={async () => {
                setLeaving(true);
                await signOut();
              }}
            >
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6 sm:pb-12">
        <QuickEntry />
        <div className="pt-6">
          <Outlet />
        </div>
      </main>
      <QuickEntryFab />

      <nav
        aria-label="Principal (mobile)"
        className="fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-canvas sm:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)', gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}
      >
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx('flex flex-col items-center gap-1 py-2.5 text-[0.7rem] font-semibold', isActive ? 'text-brand' : 'text-mute')
            }
          >
            <Icon size={20} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
