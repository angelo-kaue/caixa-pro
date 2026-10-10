import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { buttonClasses } from '@/components/ui/Button';

const links = [
  ['Funcionalidades', '#funcionalidades'],
  ['Para quem é', '#para-quem'],
  ['Planos', '#planos'],
  ['Perguntas frequentes', '#faq'],
] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link to="/" aria-label="CaixaPro, página inicial">
          <Logo />
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-7 md:flex">
          {links.map(([label, href]) => (
            <a key={href} href={href} className="text-sm font-medium text-mute transition-colors hover:text-fg">
              {label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link to="/entrar" className={buttonClasses('ghost', 'md')}>
            Entrar
          </Link>
          <Link to="/cadastro" className={buttonClasses('primary', 'md')}>
            Começar grátis
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-mute hover:bg-surface hover:text-fg md:hidden"
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={open}
          aria-controls="menu-mobile"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div id="menu-mobile" className="border-t border-line bg-canvas px-5 pb-5 pt-3 md:hidden">
          <nav aria-label="Principal (mobile)" className="flex flex-col">
            {links.map(([label, href]) => (
              <a
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="border-b border-line/70 py-3 text-sm font-medium text-mute hover:text-fg"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link to="/entrar" className={buttonClasses('secondary', 'md')}>
              Entrar
            </Link>
            <Link to="/cadastro" className={buttonClasses('primary', 'md')}>
              Começar grátis
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
