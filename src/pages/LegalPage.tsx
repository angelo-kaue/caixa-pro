import { Link } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Logo } from '@/components/ui/Logo';
import { LEGAL } from '@/config/legal';
import { getLegalDoc, type LegalDoc } from '@/content/legal';

export function LegalPage({ doc }: { doc: LegalDoc }) {
  const { title, sections } = getLegalDoc(doc);
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link to="/" aria-label="Voltar ao início">
        <Logo />
      </Link>
      <h1 className="mt-10 text-h1">{title}</h1>
      <p className="mt-2 text-sm text-faint">Atualizado em {LEGAL.updatedAt}</p>
      {!LEGAL.reviewed && (
        <div className="mt-6">
          <Alert tone="info">Versão preliminar, ainda em revisão. O texto pode mudar antes da abertura ao público.</Alert>
        </div>
      )}
      <div className="mt-8 space-y-8">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="text-h3">{s.title}</h2>
            <div className="mt-2 space-y-3 text-sm leading-relaxed text-mute">
              {s.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
      <Link to="/" className="mt-10 inline-block text-sm font-semibold text-brand hover:underline">
        Voltar ao início
      </Link>
    </main>
  );
}
