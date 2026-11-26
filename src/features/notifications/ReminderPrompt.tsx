import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { VAPID_PUBLIC_KEY, enablePush, getPushSupport, pushErrorMessage } from './push';

const DISMISS_KEY = 'caixapro:reminder-prompt-dismissed';

function shouldShow(): boolean {
  if (!VAPID_PUBLIC_KEY || getPushSupport() !== 'ready' || Notification.permission !== 'default') return false;
  try {
    return localStorage.getItem(DISMISS_KEY) === null;
  } catch {
    return true;
  }
}

/** Convite discreto no Resumo para ativar os lembretes. Some depois de ativar ou de "Agora não". */
export function ReminderPrompt() {
  const [visible, setVisible] = useState(shouldShow);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* sem armazenamento: o convite volta na próxima visita */
    }
    setVisible(false);
  };

  return (
    <div className="space-y-3 rounded-lg border border-line bg-surface p-4">
      <p className="text-sm text-fg">
        <strong>Esqueceu de registrar?</strong> Ative os lembretes e a gente te avisa, no máximo 3 vezes por dia.
      </p>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await enablePush();
              setVisible(false);
            } catch (e) {
              setError(pushErrorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Ativar lembretes
        </Button>
        <Button size="sm" variant="ghost" onClick={dismiss} disabled={busy}>
          Agora não
        </Button>
      </div>
    </div>
  );
}
