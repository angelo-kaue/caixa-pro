import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { useAuth } from '@/features/auth/AuthProvider';

/** Provisória: a configuração inicial e o dashboard entram na Fase 2. */
export function AppHomePage() {
  const { user, signOut } = useAuth();
  const [leaving, setLeaving] = useState(false);

  return (
    <div className="flex min-h-screen flex-col px-5 py-8">
      <header className="flex items-center justify-between">
        <Logo />
        <Button
          variant="secondary"
          size="sm"
          loading={leaving}
          onClick={async () => {
            setLeaving(true);
            await signOut();
          }}
        >
          Sair
        </Button>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
        <h1 className="text-h1">Conta ativa</h1>
        <p className="mt-3 text-mute">
          Você está conectado como <span className="text-fg">{user?.email}</span>. A configuração do espaço de trabalho e
          o registro de lançamentos serão a próxima etapa do produto.
        </p>
      </main>
    </div>
  );
}
