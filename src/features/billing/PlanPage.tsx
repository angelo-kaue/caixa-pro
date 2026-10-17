import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { BILLING_ENABLED, PIX_PERIOD_DAYS, SELLABLE_PLANS } from '@/config/billing';
import { PLANS, PLAN_ORDER, type PlanId } from '@/config/plans';
import { formatDateBR, toISODate } from '@/domain/dates';
import { formatCentsToBRL } from '@/domain/money';
import { cancelSubscription, createCheckout, syncBilling, type SyncOutcome } from '@/services/billingService';
import { describePurchase } from './purchaseCopy';
import { useWorkspace } from '@/features/workspace/WorkspaceProvider';

const RETURN_PARAMS = ['preapproval_id', 'payment_id', 'collection_id', 'collection_status', 'status'];
const POLL_MS = 4000;
const POLL_MAX = 15;

function describeStatus(status: string, cancelAtEnd: boolean): { label: string; tone: 'income' | 'warn' | 'neutral' } {
  if (status === 'active' && !cancelAtEnd) return { label: 'Ativo', tone: 'income' };
  if (status === 'canceled' || cancelAtEnd) return { label: 'Cancelado (vale até o fim do período)', tone: 'warn' };
  if (status === 'past_due') return { label: 'Pagamento pendente', tone: 'warn' };
  return { label: 'Aguardando confirmação', tone: 'neutral' };
}

export function PlanPage() {
  const { plan, subscription, refreshBilling, bump, workspace } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const returned = RETURN_PARAMS.some((k) => params.has(k));
  // O Mercado Pago devolve o número do pagamento na URL de retorno; só dígitos são aceitos.
  const rawPaymentId = params.get('payment_id') ?? params.get('collection_id');
  const paymentId = rawPaymentId && /^\d{1,20}$/.test(rawPaymentId) ? rawPaymentId : undefined;
  const [confirming, setConfirming] = useState(returned);
  const [timedOut, setTimedOut] = useState(false);
  const [busy, setBusy] = useState<'card' | 'pix' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [pendingMode, setPendingMode] = useState<'card' | 'pix' | null>(null);
  const [diagnostic, setDiagnostic] = useState<SyncOutcome[] | null>(null);
  const planRef = useRef<PlanId>(plan);
  planRef.current = plan;

  // Pergunta ao servidor se o pagamento já foi confirmado pelo Mercado Pago e atualiza o plano.
  async function checkNow(): Promise<boolean> {
    try {
      const d = await syncBilling(paymentId);
      if (d) setDiagnostic(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível verificar agora.');
    }
    await refreshBilling();
    return planRef.current !== 'free';
  }

  // Ao voltar do Mercado Pago, verifica na hora e depois a cada poucos segundos (sem depender do webhook).
  useEffect(() => {
    if (!returned) return;
    let tries = 0;
    let stopped = false;
    const finish = () => {
      stopped = true;
      window.clearInterval(timer);
    };
    const tick = async () => {
      if (stopped) return;
      tries += 1;
      const done = await checkNow();
      if (stopped) return;
      if (done) {
        finish();
        setConfirming(false);
        bump();
        setParams({}, { replace: true });
      } else if (tries >= POLL_MAX) {
        finish();
        setConfirming(false);
        setTimedOut(true);
      }
    };
    const timer = window.setInterval(() => void tick(), POLL_MS);
    void tick();
    return finish;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returned]);

  async function manualCheck() {
    setChecking(true);
    setError(null);
    const done = await checkNow();
    setChecking(false);
    if (done) bump();
  }

  async function buy(mode: 'card' | 'pix') {
    setBusy(mode);
    setError(null);
    try {
      window.location.assign(await createCheckout('pro', mode));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível iniciar a contratação.');
      setBusy(null);
    }
  }

  const purchaseCtx = { plan, status: subscription?.status ?? null, billingMode: subscription?.billing_mode ?? null, accessUntil: subscription?.access_until ?? null };
  const cardCopy = describePurchase('card', purchaseCtx);
  const pixCopy = describePurchase('pix', purchaseCtx);
  // Com um plano pago em vigor, avisa o que vai acontecer antes de seguir para o pagamento.
  const startPurchase = (mode: 'card' | 'pix') => ((mode === 'card' ? cardCopy : pixCopy).confirm ? setPendingMode(mode) : void buy(mode));

  const status = subscription ? describeStatus(subscription.status, subscription.cancel_at_period_end) : null;
  const until = subscription?.access_until ? formatDateBR(toISODate(new Date(subscription.access_until))) : null;
  const canCancel = subscription?.billing_mode === 'card' && subscription.status === 'active' && plan !== 'free';

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-h1">Plano e cobrança</h1>
        <p className="mt-1 text-sm text-mute">Espaço: {workspace?.name}</p>
      </div>

      {confirming && <Alert tone="info">Estamos confirmando seu pagamento com o Mercado Pago. Isso costuma levar alguns segundos; Pix e cartão podem levar alguns minutos.</Alert>}
      {timedOut && <Alert tone="info">Ainda não recebemos a confirmação. Se você concluiu o pagamento, o plano será liberado assim que o Mercado Pago avisar. Atualize esta página em alguns minutos.</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      {diagnostic && (
        <Alert tone="info">
          <p className="font-semibold text-fg">Diagnóstico (modo de teste)</p>
          {diagnostic.length === 0 ? (
            <p>Nenhuma compra recente encontrada para este espaço.</p>
          ) : (
            <ul className="mt-1 list-disc pl-5">
              {diagnostic.map((d) => (
                <li key={d.checkoutId}>
                  {d.mode === 'pix' ? 'Pix' : 'Cartão'}: {d.outcomes.join(', ')}
                </li>
              ))}
            </ul>
          )}
        </Alert>
      )}
      {!BILLING_ENABLED && <Alert tone="info">A contratação de planos pagos ainda não está disponível. Você continua usando o plano Free sem custo.</Alert>}

      <section aria-label="Plano atual">
        <p className="text-sm font-semibold uppercase tracking-wide text-faint">Plano atual</p>
        <p className="mt-2 flex flex-wrap items-center gap-3 text-[2rem] font-extrabold leading-none tracking-tight">
          {PLANS[plan].name}
          {status && plan !== 'free' && <Badge tone={status.tone}>{status.label}</Badge>}
        </p>
        {plan !== 'free' && subscription && (
          <ul className="mt-3 space-y-1 text-sm text-mute">
            {until && <li>Acesso garantido até <strong className="num text-fg">{until}</strong></li>}
            {subscription.billing_mode === 'card' && <li>Cartão: renovação automática todo mês.</li>}
            {subscription.billing_mode === 'pix' && <li>Pix: pagamento avulso de {PIX_PERIOD_DAYS} dias, sem renovação automática.</li>}
            {subscription.billing_mode === null && <li>Plano liberado manualmente, sem cobrança automática.</li>}
          </ul>
        )}
        {plan === 'free' && subscription && subscription.status === 'canceled' && <p className="mt-3 text-sm text-mute">Seu plano pago terminou. Seus dados continuam guardados.</p>}
        {BILLING_ENABLED && plan === 'free' && (
          <div className="mt-4">
            <Button variant="secondary" size="sm" loading={checking} onClick={() => void manualCheck()}>
              Já paguei: verificar agora
            </Button>
            <p className="mt-1.5 text-xs text-faint">Use se você concluiu o pagamento e o plano ainda aparece como Free.</p>
          </div>
        )}
        {canCancel && (
          <Button variant="secondary" size="sm" className="mt-4" onClick={() => setCancelOpen(true)}>
            Cancelar assinatura
          </Button>
        )}
      </section>

      <section aria-label="Planos disponíveis">
        <h2 className="text-h3">Planos</h2>
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          {PLAN_ORDER.map((id) => {
            const p = PLANS[id];
            const sellable = SELLABLE_PLANS.includes(id);
            const current = plan === id;
            return (
              <article key={id} className={`flex flex-col rounded-lg border p-5 ${current ? 'border-brand/60 bg-surface' : 'border-line'}`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-h3">{p.name}</h3>
                  {current && <Badge tone="income">Seu plano</Badge>}
                </div>
                <p className="mt-1 text-sm text-mute">{p.tagline}</p>
                <p className="mt-4 flex items-baseline gap-1.5">
                  {p.priceIsStartingAt && <span className="text-sm text-mute">a partir de</span>}
                  <span className="num text-2xl font-extrabold">{p.priceCents === 0 ? 'R$ 0' : formatCentsToBRL(p.priceCents)}</span>
                  {p.priceCents > 0 && <span className="text-sm text-mute">/mês</span>}
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-sm">
                  {p.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2">
                      <Check size={14} className="mt-1 shrink-0 text-brand" aria-hidden="true" />
                      <span className="text-mute">{h}</span>
                    </li>
                  ))}
                </ul>
                {id === 'enterprise' && <p className="mt-4 text-xs text-faint">Em desenvolvimento: ainda não está disponível para contratação.</p>}
                {sellable && BILLING_ENABLED && (
                  <div className="mt-5 space-y-2">
                    <Button className="w-full" loading={busy === 'card'} disabled={busy !== null || (current && cardCopy.disabled)} onClick={() => startPurchase('card')}>
                      {current ? cardCopy.label : 'Assinar no cartão (mensal)'}
                    </Button>
                    <Button variant="secondary" className="w-full" loading={busy === 'pix'} disabled={busy !== null} onClick={() => startPurchase('pix')}>
                      {current ? pixCopy.label : `Pagar ${PIX_PERIOD_DAYS} dias com Pix`}
                    </Button>
                    <p className="text-xs text-faint">Cartão renova sozinho e você pode cancelar quando quiser. Pix libera {PIX_PERIOD_DAYS} dias e precisa ser pago de novo para continuar.</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
        <p className="mt-5 max-w-2xl text-xs text-faint">
          O pagamento é feito no ambiente do Mercado Pago; o CaixaPro não recebe nem guarda dados do seu cartão. Ao deixar o plano pago, seus dados continuam guardados: você só volta aos limites do Free.{' '}
          <Link to="/termos" className="underline hover:text-fg">Termos de uso</Link>.
        </p>
      </section>

      <ConfirmDialog
        open={pendingMode !== null}
        title="Antes de continuar"
        confirmLabel="Continuar para o pagamento"
        danger={false}
        onClose={() => setPendingMode(null)}
        onConfirm={async () => {
          const mode = pendingMode;
          setPendingMode(null);
          if (mode) await buy(mode);
          return null;
        }}
      >
        {pendingMode === 'card' ? cardCopy.confirm : pixCopy.confirm}
      </ConfirmDialog>

      <ConfirmDialog
        open={cancelOpen}
        title="Cancelar assinatura?"
        confirmLabel="Cancelar assinatura"
        onClose={() => setCancelOpen(false)}
        onConfirm={async () => {
          try {
            await cancelSubscription();
            await refreshBilling();
            return null;
          } catch (e) {
            return e instanceof Error ? e.message : 'Não foi possível cancelar agora.';
          }
        }}
      >
        A cobrança mensal será interrompida. Você continua com o plano Pro até o fim do período já pago{until ? ` (${until})` : ''}. Seus dados não serão apagados.
      </ConfirmDialog>
    </div>
  );
}
