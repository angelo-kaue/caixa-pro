import { Link } from 'react-router-dom';
import { buttonClasses } from '@/components/ui/Button';

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="num text-sm font-semibold text-brand">404</p>
      <h1 className="text-h1">Página não encontrada</h1>
      <p className="max-w-md text-mute">O endereço que você tentou acessar não existe ou foi movido.</p>
      <Link to="/" className={buttonClasses('secondary', 'md', 'mt-2')}>
        Voltar ao início
      </Link>
    </main>
  );
}
