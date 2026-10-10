import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { buttonClasses } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';

const recent = [
  { label: 'Salário', category: 'Salário', cents: 250000, kind: 'income' as const },
  { label: 'Mercado', category: 'Alimentação', cents: -18640, kind: 'expense' as const },
  { label: 'Conta de internet', category: 'Contas e serviços', cents: -9990, kind: 'expense' as const },
];

function PreviewPanel() {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="border-b border-line px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">Lançamento rápido</p>
        <div className="mt-2.5 flex h-11 items-center rounded-md border border-brand/60 bg-canvas2 px-3.5 text-[0.95rem]">
          <span>50 Uber</span>
          <span className="ml-0.5 inline-block h-5 w-px animate-pulse bg-brand" aria-hidden="true" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
          <span className="text-mute">
            Valor <Money cents={5000} className="ml-1 text-fg" />
          </span>
          <span className="text-mute">
            Tipo <span className="ml-1 font-semibold text-expense">Despesa</span>
          </span>
          <span className="text-mute">
            Categoria <span className="ml-1 font-semibold text-fg">Transporte</span>
          </span>
          <span className="ml-auto inline-flex items-center gap-1 font-semibold text-brand">
            <Check size={14} aria-hidden="true" /> Confirmar
          </span>
        </div>
      </div>

      <div className="px-5 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">Saldo registrado</p>
        <p className="num mt-1 text-[2rem] font-extrabold leading-none tracking-tight">R$ 2.221,70</p>
      </div>

      <ul className="mt-4 divide-y divide-line/70 border-t border-line">
        {recent.map((r) => (
          <li key={r.label} className="flex items-center justify-between px-5 py-3 text-sm">
            <span>
              <span className="block font-medium">{r.label}</span>
              <span className="text-xs text-faint">{r.category}</span>
            </span>
            <Money cents={r.cents} tone={r.kind} />
          </li>
        ))}
      </ul>
      <p className="border-t border-line px-5 py-2.5 text-xs text-faint">Exemplo ilustrativo da interface.</p>
    </div>
  );
}

export function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pb-28 lg:pt-20">
      <div>
        <p className="mb-5 text-sm font-semibold text-brand">Gestão financeira para pessoas e pequenos negócios</p>
        <h1 className="text-[2.5rem] font-extrabold leading-[1.05] tracking-[-0.035em] sm:text-display">
          Controle seu dinheiro. Entenda suas escolhas.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-mute">
          Organize suas receitas e despesas, acompanhe seu fluxo financeiro e tenha mais clareza para decidir o que fazer
          com seu dinheiro.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link to="/cadastro" className={buttonClasses('primary', 'lg')}>
            Começar grátis <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <a href="#como-funciona" className={buttonClasses('secondary', 'lg')}>
            Conhecer a plataforma
          </a>
        </div>
        <ul className="mt-9 space-y-2.5 text-sm text-mute">
          {[
            'Registre um gasto digitando como falaria: "50 Uber".',
            'Pessoal e empresa em espaços separados.',
            'Plano Free sem cartão de crédito.',
          ].map((t) => (
            <li key={t} className="flex items-start gap-2.5">
              <Check size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>
      </div>
      <PreviewPanel />
    </section>
  );
}
