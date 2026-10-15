import { useEffect, useState } from 'react';
import { EllipsisVertical, Share, SquarePlus, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { detectPlatform, isStandalone } from './platform';

const DISMISS_KEY = 'caixapro.installHint.dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Mode = 'ios' | 'ios-other' | 'prompt' | 'android-manual';

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

const b = (t: string) => <strong className="text-fg">{t}</strong>;

/** Orientação discreta para instalar o CaixaPro na tela inicial. Some para sempre depois de dispensada. */
export function InstallHint() {
  const { pathname } = useLocation();
  const [mode, setMode] = useState<Mode | null>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (wasDismissed() || isStandalone()) return;
    const platform = detectPlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
    if (platform === 'desktop') return;

    const timers: number[] = [];
    if (platform === 'ios-safari') timers.push(window.setTimeout(() => setMode('ios'), 3000));
    if (platform === 'ios-other') timers.push(window.setTimeout(() => setMode('ios-other'), 3000));
    if (platform === 'android') {
      // Se o navegador não oferecer o botão de instalar, mostramos o caminho pelo menu.
      timers.push(window.setTimeout(() => setMode((m) => m ?? 'android-manual'), 6000));
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode('prompt');
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  if (!mode || pathname === '/instalar') return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* sem armazenamento: apenas fecha nesta sessão */
    }
    setMode(null);
  };

  const inApp = pathname.startsWith('/app');

  return (
    <div
      role="region"
      aria-label="Instalar o CaixaPro"
      className="fixed inset-x-0 z-50 px-4"
      style={{ bottom: inApp ? 'calc(4.5rem + env(safe-area-inset-bottom))' : 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto max-w-md rounded-lg border border-line2 bg-surface px-4 py-3.5 text-sm shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="font-semibold">
              {mode === 'prompt' ? 'Instale o CaixaPro no seu celular' : 'Use o CaixaPro como um app de verdade'}
            </p>
            <p className="mt-1 text-mute">Adicione o CaixaPro à sua tela inicial para acessar mais rapidamente, em tela cheia.</p>

            {mode === 'ios' && (
              <ol className="mt-2.5 space-y-1.5 text-mute">
                <li>
                  1. Toque em {b('Compartilhar')} <Share size={15} className="inline align-[-2px]" aria-hidden="true" /> (barra de baixo)
                </li>
                <li>
                  2. Escolha {b('Adicionar à Tela de Início')} <SquarePlus size={15} className="inline align-[-2px]" aria-hidden="true" />
                </li>
                <li>3. Toque em {b('Adicionar')}</li>
              </ol>
            )}
            {mode === 'ios-other' && (
              <p className="mt-2.5 text-mute">
                Neste navegador a instalação não funciona. Abra o endereço no {b('Safari')}, toque em {b('Compartilhar')} e depois em {b('Adicionar à Tela de Início')}.
              </p>
            )}
            {mode === 'android-manual' && (
              <p className="mt-2.5 text-mute">
                Toque nos três pontinhos <EllipsisVertical size={15} className="inline align-[-2px]" aria-hidden="true" /> do navegador e escolha {b('Instalar app')} (ou {b('Adicionar à tela inicial')}).
              </p>
            )}
            {mode === 'prompt' && (
              <Button
                size="sm"
                className="mt-3"
                onClick={async () => {
                  if (!deferred) return;
                  await deferred.prompt();
                  await deferred.userChoice;
                  dismiss();
                }}
              >
                Instalar
              </Button>
            )}
            <Link to="/instalar" className="mt-2.5 inline-block text-xs font-semibold text-brand hover:underline">
              Ver passo a passo
            </Link>
          </div>
          <button type="button" onClick={dismiss} aria-label="Dispensar e não mostrar de novo" className="rounded-md p-1 text-mute hover:bg-surface2 hover:text-fg">
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
