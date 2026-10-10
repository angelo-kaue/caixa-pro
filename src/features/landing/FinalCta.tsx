import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { buttonClasses } from '@/components/ui/Button';

export function FinalCta() {
  return (
    <section className="border-t border-line bg-canvas2 py-20">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-5 sm:px-8 md:flex-row md:items-center">
        <div>
          <h2 className="max-w-xl text-h1">Registre o primeiro lançamento em menos de um minuto</h2>
          <p className="mt-3 text-mute">Crie sua conta no plano Free e comece com o que importa hoje.</p>
        </div>
        <Link to="/cadastro" className={buttonClasses('primary', 'lg', 'shrink-0')}>
          Começar grátis <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
