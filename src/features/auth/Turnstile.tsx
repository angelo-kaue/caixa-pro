import { useEffect, useRef, useState } from 'react';
import { TURNSTILE_SITE_KEY } from './captcha';

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error('turnstile'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

interface Props {
  /** Recebe o código da verificação (ou null quando expira/falha). Cada código vale para um único envio. */
  onToken: (token: string | null) => void;
  /** Aumente este número depois de cada envio para pedir uma verificação nova. */
  resetSignal: number;
}

/** Verificação anti-robô (Cloudflare Turnstile). Não renderiza nada se a chave não estiver configurada. */
export function Turnstile({ onToken, resetSignal }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const handler = useRef(onToken);
  handler.current = onToken;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let active = true;
    loadScript()
      .then(() => {
        if (!active || !box.current || !window.turnstile) return;
        widget.current = window.turnstile.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'dark',
          language: 'pt-br',
          callback: (token: string) => handler.current(token),
          'expired-callback': () => handler.current(null),
          'error-callback': () => {
            handler.current(null);
            setFailed(true);
          },
        });
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, []);

  useEffect(() => {
    if (resetSignal > 0 && widget.current && window.turnstile) {
      handler.current(null);
      window.turnstile.reset(widget.current);
    }
  }, [resetSignal]);

  if (!TURNSTILE_SITE_KEY) return null;
  return (
    <div>
      <div ref={box} />
      {failed && <p className="mt-2 text-xs text-expense">Não foi possível carregar a verificação de segurança. Recarregue a página e tente de novo.</p>}
    </div>
  );
}
