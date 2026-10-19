import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';

/** No celular, depois de rolar a página, um "+" leva de volta à barra de lançamento rápido. */
export function QuickEntryFab() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 240);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!show) return null;
  return (
    <button
      type="button"
      aria-label="Novo lançamento"
      onClick={() => {
        // O foco precisa acontecer no mesmo toque do usuário (no iPhone, senão o teclado não abre).
        document.getElementById('quick-entry')?.focus({ preventScroll: true });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }}
      className="fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-canvas shadow-lg transition-colors hover:bg-brand-dark sm:hidden"
      style={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom))' }}
    >
      <Plus size={26} aria-hidden="true" />
    </button>
  );
}
