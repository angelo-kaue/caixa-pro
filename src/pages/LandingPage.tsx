import { Logo } from '@/components/ui/Logo';

/** Provisória. A landing page completa entra na etapa 1B. */
export function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo size={36} />
      <h1 className="text-h1">Controle seu dinheiro. Entenda suas escolhas.</h1>
    </main>
  );
}
