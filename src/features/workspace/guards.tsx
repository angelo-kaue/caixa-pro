import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useWorkspace } from './WorkspaceProvider';

export function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-mute" role="status" aria-label="Carregando">
      <Spinner className="h-6 w-6" />
    </div>
  );
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col items-center justify-center gap-4 px-5 text-center">
      <Alert tone="error">{message}</Alert>
      <Button variant="secondary" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  );
}

/** Garante que o usuário já configurou o espaço de trabalho antes de ver o app. */
export function RequireWorkspace({ children }: { children: ReactNode }) {
  const { status, error, reload } = useWorkspace();
  if (status === 'loading') return <Loading />;
  if (status === 'error') return <LoadError message={error ?? 'Não foi possível carregar seus dados.'} onRetry={() => void reload()} />;
  if (status === 'none') return <Navigate to="/app/configuracao" replace />;
  return <>{children}</>;
}
