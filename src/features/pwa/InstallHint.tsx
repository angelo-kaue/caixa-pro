import { useEffect, useState } from 'react';
import { Share, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const DISMISS_KEY = 'caixapro.installHint.dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return ios && safari;
}

/** Orientação discreta de instalação. Some para sempre depois de dispensada. */
export function InstallHint() {
  const [mode, setMode] = useState<'ios' | 'prompt' | null>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (wasDismissed() || isStandalone()) return;

    let timer: number | undefined;
    if (isIosSafari()) {
      timer = window.setTimeout(() => setMode('ios'), 3000);
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode('prompt');
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  if (!mode) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* sem armazenamento: apenas fecha nesta sessão */
    }
    setMode(null);
  };

  return (
    <div
      role="region"
      aria-label="Instalar o CaixaPro"
      className="fixed inset-x-0 bottom-0 z-50 px-4"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto flex max-w-md items-start gap-3 rounded-lg border border-line2 bg-surface px-4 py-3 text-sm shadow-lg">
        <div className="flex-1">
          <p className="font-semibold">Adicione o CaixaPro à sua tela inicial para acessar mais rapidamente.</p>
          {mode === 'ios' ? (
            <p className="mt-1 text-mute">
              Toque em <Share size={14} className="mx-0.5 inline align-[-2px]" aria-hidden="true" />
              <strong className="text-fg"> Compartilhar</strong> e depois em{' '}
              <strong className="text-fg">Adicionar à Tela de Início</strong>.
            </p>
          ) : (
            <Button
              size="sm"
              className="mt-2"
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
        </div>
        <button type="button" onClick={dismiss} aria-label="Dispensar" className="rounded-md p-1 text-mute hover:bg-surface2 hover:text-fg">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
