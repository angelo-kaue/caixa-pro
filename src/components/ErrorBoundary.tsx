import { Component, type ReactNode } from 'react';

interface State {
  failed: boolean;
}

/** Evita a tela em branco se algo inesperado quebrar a interface. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    console.error('Erro inesperado na interface:', error.message);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-h1">Algo deu errado</h1>
        <p className="max-w-md text-mute">Aconteceu um erro inesperado. Seus dados estão salvos. Recarregue a página para continuar.</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-2 inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-semibold text-canvas hover:bg-brand-dark">
          Recarregar
        </button>
      </main>
    );
  }
}
