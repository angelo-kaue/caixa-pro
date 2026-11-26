import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { VAPID_PUBLIC_KEY, currentSubscription, disablePush, enablePush, getPushSupport, pushErrorMessage, sendTestPush } from './push';

type Busy = 'on' | 'off' | 'test' | null;

/** Seção "Lembretes" da página Minha conta. Não aparece se a chave VAPID não estiver configurada. */
export function ReminderSettings() {
  const [support] = useState(getPushSupport);
  const [active, setActive] = useState(false);
  const [blocked, setBlocked] = useState(() => typeof Notification !== 'undefined' && Notification.permission === 'denied');
  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState<{ tone: 'info' | 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!VAPID_PUBLIC_KEY || support !== 'ready') return;
    let alive = true;
    void currentSubscription().then((sub) => {
      if (alive) setActive(sub !== null && Notification.permission === 'granted');
    });
    return () => {
      alive = false;
    };
  }, [support]);

  if (!VAPID_PUBLIC_KEY) return null;

  async function run(kind: Exclude<Busy, null>, fn: () => Promise<void>) {
    setBusy(kind);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setNotice({ tone: 'error', text: pushErrorMessage(e) });
      if (typeof Notification !== 'undefined') setBlocked(Notification.permission === 'denied');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="reminders-title" className="border-t border-line pt-8">
      <h2 id="reminders-title" className="text-h3">
        Lembretes
      </h2>
      <p className="mt-1.5 text-sm text-mute">
        Receba um aviso para registrar seus gastos, no máximo 3 vezes por dia. Se você já lançou algo no dia, não avisamos.
      </p>

      <div className="mt-4 space-y-3">
        {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

        {support === 'unsupported' && <Alert>Este navegador não permite notificações. Tente pelo Chrome (Android) ou pelo app instalado.</Alert>}
        {support === 'needs-install' && (
          <Alert>No iPhone, primeiro instale o CaixaPro na tela de início (veja “Instalar no celular” logo abaixo). Depois abra o app instalado e volte aqui para ativar.</Alert>
        )}
        {support === 'ready' && blocked && !active && (
          <Alert tone="error">As notificações estão bloqueadas neste aparelho. Libere nas configurações do navegador (ou do app) e volte aqui.</Alert>
        )}

        {support === 'ready' && !active && !blocked && (
          <Button
            loading={busy === 'on'}
            onClick={() =>
              void run('on', async () => {
                await enablePush();
                setActive(true);
                setNotice({ tone: 'success', text: 'Lembretes ativados neste aparelho. Toque em “Enviar teste” para ver como chega.' });
              })
            }
          >
            Ativar lembretes
          </Button>
        )}

        {support === 'ready' && active && (
          <>
            <p className="text-sm text-income">Lembretes ativos neste aparelho.</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                loading={busy === 'test'}
                onClick={() =>
                  void run('test', async () => {
                    const sent = await sendTestPush();
                    setNotice(
                      sent > 0
                        ? { tone: 'success', text: 'Enviamos! A notificação deve chegar em alguns segundos.' }
                        : { tone: 'error', text: 'Não encontramos um aparelho ativo. Desative e ative os lembretes de novo.' },
                    );
                  })
                }
              >
                Enviar teste
              </Button>
              <Button
                variant="ghost"
                loading={busy === 'off'}
                onClick={() =>
                  void run('off', async () => {
                    await disablePush();
                    setActive(false);
                    setNotice({ tone: 'info', text: 'Lembretes desativados neste aparelho.' });
                  })
                }
              >
                Desativar
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
