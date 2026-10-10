import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from './AuthProvider';

function FullScreenLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center text-mute" role="status" aria-label="Carregando">
      <Spinner className="h-6 w-6" />
    </div>
  );
}

/** Só renderiza para usuários autenticados; senão envia para o login guardando o destino. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenLoading />;
  if (!session) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

/** Páginas de login/cadastro: usuários já autenticados vão direto para o app. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { session, loading, recovery } = useAuth();
  if (loading) return <FullScreenLoading />;
  if (session && !recovery) return <Navigate to="/app" replace />;
  return <>{children}</>;
}
