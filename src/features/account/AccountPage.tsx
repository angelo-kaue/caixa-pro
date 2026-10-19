import { useState } from 'react';
import { Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { todayISO } from '@/domain/dates';
import { downloadTextFile } from '@/lib/download';
import { deleteAccount, exportMyData, isDeletionConfirmed } from '@/services/accountService';
import { mapDbError } from '@/services/dbErrors';
import { useAuth } from '@/features/auth/AuthProvider';
import { useWorkspace } from '@/features/workspace/WorkspaceProvider';

export function AccountPage() {
  const { user } = useAuth();
  const { subscription, plan } = useWorkspace();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function onExport() {
    setExporting(true);
    setExportError(null);
    try {
      const data = await exportMyData();
      downloadTextFile(`caixapro-meus-dados-${todayISO()}.json`, JSON.stringify(data, null, 2), 'application/json;charset=utf-8');
    } catch (e) {
      setExportError(mapDbError(e));
    } finally {
      setExporting(false);
    }
  }

  async function onDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount(confirm);
      window.location.assign('/');
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Não foi possível excluir a conta agora.');
      setDeleting(false);
    }
  }

  const hasCard = subscription?.billing_mode === 'card' && subscription.status === 'active' && plan !== 'free';

  return (
    <div className="max-w-2xl space-y-12">
      <div>
        <h1 className="page-title">Minha conta</h1>
        <p className="mt-1 text-sm text-mute">
          Conectado como <span className="text-fg">{user?.email}</span>
        </p>
      </div>

      <section aria-labelledby="install-title">
        <h2 id="install-title" className="text-h3">Instalar no celular</h2>
        <p className="mt-1.5 text-sm text-mute">Adicione o CaixaPro à tela inicial para abrir em tela cheia, como um app.</p>
        <Link to="/instalar" className="mt-3 inline-block text-sm font-semibold text-brand hover:underline">Ver o passo a passo</Link>
      </section>

      <section aria-labelledby="export-title" className="border-t border-line pt-8">
        <h2 id="export-title" className="text-h3">Baixar meus dados</h2>
        <p className="mt-1.5 text-sm text-mute">
          Um arquivo JSON com tudo o que o CaixaPro guarda sobre você: lançamentos, categorias, orçamentos, metas, recorrências, contas e assinatura.
        </p>
        {exportError && <div className="mt-3"><Alert tone="error">{exportError}</Alert></div>}
        <Button variant="secondary" className="mt-4" loading={exporting} onClick={() => void onExport()}>
          <Download size={16} aria-hidden="true" /> Baixar meus dados
        </Button>
      </section>

      <section aria-labelledby="delete-title" className="border-t border-line pt-8">
        <h2 id="delete-title" className="text-h3 text-expense">Excluir minha conta</h2>
        <p className="mt-1.5 text-sm text-mute">
          Apaga a sua conta e <strong className="text-fg">todos os seus dados</strong>, de forma definitiva. Não dá para desfazer. Se quiser guardar uma cópia, baixe os seus dados antes.
        </p>
        {hasCard && <p className="mt-2 text-sm text-mute">Sua assinatura no cartão será cancelada antes da exclusão, e nenhuma nova cobrança será feita.</p>}
        {deleteError && <div className="mt-3"><Alert tone="error">{deleteError}</Alert></div>}
        <div className="mt-4 max-w-xs space-y-3">
          <Input label="Para confirmar, digite EXCLUIR" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          <Button variant="danger" disabled={!isDeletionConfirmed(confirm)} loading={deleting} onClick={() => void onDelete()}>
            Excluir minha conta para sempre
          </Button>
        </div>
        <p className="mt-4 text-xs text-faint">
          Cópias de segurança do provedor podem manter os dados por um período limitado antes de serem descartadas. Mais detalhes na{' '}
          <Link to="/privacidade" className="underline hover:text-fg">Política de privacidade</Link>.
        </p>
      </section>
    </div>
  );
}
