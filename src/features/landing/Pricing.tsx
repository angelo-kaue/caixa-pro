import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import clsx from 'clsx';
import { PLANS, PLAN_ORDER, type PlanConfig } from '@/config/plans';
import { buttonClasses } from '@/components/ui/Button';
import { BILLING_ENABLED } from '@/config/billing';
import { formatCentsToBRL } from '@/domain/money';

function priceLabel(plan: PlanConfig): { main: string; prefix?: string; suffix?: string } {
  if (plan.priceCents === 0) return { main: 'R$ 0' };
  return {
    main: formatCentsToBRL(plan.priceCents),
    prefix: plan.priceIsStartingAt ? 'a partir de' : undefined,
    suffix: '/mês',
  };
}

export function Pricing() {
  return (
    <section id="planos" className="border-t border-line bg-canvas2 py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <h2 className="max-w-xl text-h1">Planos</h2>
        <p className="mt-4 max-w-2xl text-mute">
          Comece no Free e use o essencial sem prazo. Os planos pagos entram quando você precisar de mais análise ou de
          mais pessoas no mesmo caixa.
        </p>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {PLAN_ORDER.map((id) => {
            const plan = PLANS[id];
            const price = priceLabel(plan);
            const featured = id === 'pro';
            return (
              <article
                key={id}
                className={clsx(
                  'flex flex-col rounded-lg border p-6',
                  featured ? 'border-brand/60 bg-surface' : 'border-line bg-canvas',
                )}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-h3">{plan.name}</h3>
                  {featured && <span className="text-xs font-semibold text-brand">Mais indicado para quem quer analisar</span>}
                </div>
                <p className="mt-1.5 text-sm text-mute">{plan.tagline}</p>
                <p className="mt-6 flex items-baseline gap-1.5">
                  {price.prefix && <span className="text-sm text-mute">{price.prefix}</span>}
                  <span className="num text-[2rem] font-extrabold leading-none tracking-tight">{price.main}</span>
                  {price.suffix && <span className="text-sm text-mute">{price.suffix}</span>}
                </p>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                  {plan.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2.5">
                      <Check size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
                      <span className="text-mute">{h}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/cadastro"
                  className={buttonClasses(id === 'free' ? 'primary' : 'secondary', 'md', 'mt-8')}
                >
                  {id === 'free' ? 'Começar grátis' : 'Criar conta e começar no Free'}
                </Link>
              </article>
            );
          })}
        </div>
        <p className="mt-6 max-w-3xl text-xs text-faint">
          {BILLING_ENABLED
            ? 'O plano Pro pode ser contratado dentro do app, depois de criar a conta: no cartão (assinatura mensal que renova sozinha) ou no Pix (pagamento avulso de 30 dias). O Enterprise ainda está em desenvolvimento. Valores iniciais, sujeitos a ajuste.'
            : 'A contratação dos planos pagos ainda não está disponível: hoje toda conta começa no Free. O Enterprise ainda está em desenvolvimento. Valores iniciais, sujeitos a ajuste antes da cobrança.'}
        </p>
      </div>
    </section>
  );
}
