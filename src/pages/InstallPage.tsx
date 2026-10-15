import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { InstallGuide } from '@/features/pwa/InstallGuide';
import { detectPlatform } from '@/features/pwa/platform';

export function InstallPage() {
  const first = typeof navigator === 'undefined' ? undefined : detectPlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link to="/" aria-label="Voltar ao início">
        <Logo />
      </Link>
      <h1 className="mt-10 text-h1">Use o CaixaPro como um app</h1>
      <p className="mt-3 text-mute">
        Adicione o CaixaPro à sua tela inicial para acessar mais rapidamente. Ele passa a abrir em tela cheia, com o seu próprio ícone, igual a um aplicativo.
      </p>
      <ul className="mt-5 space-y-2 text-sm text-mute">
        {['Abre em um toque, sem digitar o endereço', 'Tela cheia, sem a barra do navegador', 'Os dados continuam os mesmos, em qualquer aparelho'].map((t) => (
          <li key={t} className="flex items-start gap-2.5">
            <Check size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
            {t}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-faint">Não é baixado de uma loja de aplicativos: é o mesmo CaixaPro, instalado a partir do navegador.</p>
      <div className="mt-8">
        <InstallGuide first={first} />
      </div>
      <Link to="/" className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">
        Voltar ao início
      </Link>
    </main>
  );
}
