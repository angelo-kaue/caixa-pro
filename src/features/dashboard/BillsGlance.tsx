import { Link } from 'react-router-dom';
import { Money } from '@/components/ui/Money';
import { useAsyncData } from '@/lib/useAsyncData';
import { getBillsOverview } from '@/services/planningService';
import { useWorkspace } from '@/features/workspace/WorkspaceProvider';

/** Contas pendentes e projeção de caixa para espaços de negócio. */
export function BillsGlance({ balanceCents }: { balanceCents: number }) {
  const { workspace, dataVersion } = useWorkspace();
  const { data } = useAsyncData(() => getBillsOverview(workspace?.id ?? ''), [workspace?.id, dataVersion]);
  if (!data || (data.payable_cents === 0 && data.receivable_cents === 0)) return null;

  return (
    <section aria-label="Contas a pagar e a receber">
      <div className="flex items-baseline justify-between">
        <h2 className="text-h3">Fluxo de caixa</h2>
        <Link to="/app/contas" className="text-sm font-semibold text-brand hover:underline">Ver contas</Link>
      </div>
      <dl className="mt-4 grid grid-cols-1 divide-y divide-line border-y border-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="py-4 sm:pr-6">
          <dt className="text-sm text-mute">A pagar</dt>
          <dd className="mt-1"><Money cents={data.payable_cents} tone="expense" /></dd>
        </div>
        <div className="py-4 sm:px-6">
          <dt className="text-sm text-mute">A receber</dt>
          <dd className="mt-1"><Money cents={data.receivable_cents} tone="income" /></dd>
        </div>
        <div className="py-4 sm:pl-6">
          <dt className="text-sm text-mute">Saldo projetado</dt>
          <dd className="mt-1"><Money cents={balanceCents + data.receivable_cents - data.payable_cents} tone="auto" /></dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-faint">
        Saldo registrado mais o que há a receber, menos o que há a pagar, se tudo for baixado.
        {data.overdue_count > 0 && <span className="ml-1 text-warn">{data.overdue_count} conta(s) em atraso.</span>}
      </p>
    </section>
  );
}
