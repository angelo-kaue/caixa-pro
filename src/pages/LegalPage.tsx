import { Link } from 'react-router-dom';
import { Logo } from '@/components/ui/Logo';

/** Textos legais ainda não redigidos: a página informa isso com clareza. Precisam de revisão jurídica antes do lançamento. */
export function LegalPage({ title }: { title: string }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link to="/" aria-label="Voltar ao início">
        <Logo />
      </Link>
      <h1 className="mt-10 text-h1">{title}</h1>
      <p className="mt-4 text-mute">
        Este documento está em elaboração e será publicado antes da abertura do CaixaPro ao público. Em caso de dúvidas
        sobre o uso dos seus dados, entre em contato pelos canais que serão divulgados no lançamento.
      </p>
      <Link to="/" className="mt-8 inline-block text-sm font-semibold text-brand hover:underline">
        Voltar ao início
      </Link>
    </main>
  );
}
