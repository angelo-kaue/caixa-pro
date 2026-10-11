import { useState, type FormEvent } from 'react';
import { Briefcase, User } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Logo } from '@/components/ui/Logo';
import { parseMoneyToCents } from '@/domain/money';
import { mapDbError } from '@/services/dbErrors';
import { createWorkspace } from '@/services/workspaceService';
import type { WorkspaceType } from '@/types/db';
import { LoadError, Loading } from '@/features/workspace/guards';
import { useWorkspace } from '@/features/workspace/WorkspaceProvider';

const options = [
  { type: 'personal', title: 'Organizar minhas finanças pessoais', text: 'Salário, gastos do dia a dia, orçamentos e metas.', icon: User, defaultName: 'Minhas finanças' },
  { type: 'business', title: 'Controlar as finanças do meu negócio', text: 'Vendas, despesas operacionais e fluxo de caixa.', icon: Briefcase, defaultName: 'Meu negócio' },
] as const;

export function OnboardingPage() {
  const { status, error, reload } = useWorkspace();
  const navigate = useNavigate();
  const [type, setType] = useState<WorkspaceType>('personal');
  const [name, setName] = useState('Minhas finanças');
  const [nameTouched, setNameTouched] = useState(false);
  const [balance, setBalance] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; balance?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (status === 'loading') return <Loading />;
  if (status === 'error') return <LoadError message={error ?? 'Não foi possível carregar seus dados.'} onRetry={() => void reload()} />;
  if (status === 'ready') return <Navigate to="/app" replace />;

  const chooseType = (t: WorkspaceType) => {
    setType(t);
    if (!nameTouched) setName(options.find((o) => o.type === t)?.defaultName ?? '');
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const errs: { name?: string; balance?: string } = {};
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 80) errs.name = 'Informe um nome de 1 a 80 caracteres.';
    let cents = 0;
    if (balance.trim() !== '') {
      const parsed = parseMoneyToCents(balance);
      if (parsed === null) errs.balance = 'Informe um valor válido, como 1.500,00.';
      else cents = parsed;
    }
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    setServerError(null);
    try {
      await createWorkspace(type, trimmed, cents);
      await reload();
      navigate('/app', { replace: true });
    } catch (err) {
      setServerError(mapDbError(err));
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col px-5 py-8">
      <Logo />
      <main className="mx-auto w-full max-w-md flex-1 py-10">
        <h1 className="text-h1">Como você pretende usar o CaixaPro?</h1>
        <p className="mt-2 text-mute">Leva menos de um minuto. Depois disso você já pode registrar o primeiro lançamento.</p>

        <form onSubmit={onSubmit} noValidate className="mt-8 space-y-6">
          {serverError && <Alert tone="error">{serverError}</Alert>}

          <fieldset className="space-y-3">
            <legend className="sr-only">Tipo de espaço de trabalho</legend>
            {options.map(({ type: t, title, text, icon: Icon }) => (
              <label
                key={t}
                className={clsx(
                  'flex cursor-pointer items-start gap-3.5 rounded-lg border p-4 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand',
                  type === t ? 'border-brand bg-brand-soft' : 'border-line hover:border-line2',
                )}
              >
                <input type="radio" name="type" value={t} checked={type === t} onChange={() => chooseType(t)} className="sr-only" />
                <Icon size={20} className={type === t ? 'mt-0.5 text-brand' : 'mt-0.5 text-mute'} aria-hidden="true" />
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="mt-0.5 block text-sm text-mute">{text}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <Input
            label="Nome do espaço de trabalho"
            value={name}
            maxLength={80}
            onChange={(e) => {
              setName(e.target.value);
              setNameTouched(true);
            }}
            error={fieldErrors.name}
          />
          <Input
            label="Saldo inicial (opcional)"
            inputMode="decimal"
            placeholder="0,00"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            hint="Quanto você tem hoje. É só o ponto de partida do saldo registrado; pode deixar em branco."
            error={fieldErrors.balance}
          />
          <Button type="submit" size="lg" className="w-full" loading={saving}>
            Começar
          </Button>
        </form>
      </main>
    </div>
  );
}
