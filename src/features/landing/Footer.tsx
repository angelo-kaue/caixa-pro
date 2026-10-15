import { Link } from 'react-router-dom';
import { Logo } from '@/components/ui/Logo';

export function Footer() {
  return (
    <footer className="border-t border-line py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 sm:px-8 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Logo size={24} />
          <p className="mt-3 text-xs leading-relaxed text-faint">
            Ferramenta de organização financeira. Não é software contábil nem sistema de apuração fiscal.
          </p>
        </div>
        <nav aria-label="Rodapé" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-mute">
          <a href="#funcionalidades" className="hover:text-fg">Funcionalidades</a>
          <a href="#planos" className="hover:text-fg">Planos</a>
          <a href="#faq" className="hover:text-fg">Perguntas frequentes</a>
          <Link to="/instalar" className="hover:text-fg">Instalar no celular</Link>
          <Link to="/termos" className="hover:text-fg">Termos de uso</Link>
          <Link to="/privacidade" className="hover:text-fg">Política de privacidade</Link>
        </nav>
      </div>
      <p className="mx-auto mt-8 max-w-6xl px-5 text-xs text-faint sm:px-8">© {new Date().getFullYear()} CaixaPro</p>
    </footer>
  );
}
