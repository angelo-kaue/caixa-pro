import { Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BILLING_ENABLED } from '@/config/billing';

interface UpgradeNoticeProps {
  title: string;
  description: string;
  items?: string[];
}

/** Aviso de recurso do plano Pro. A contratação ainda não existe, e o texto diz isso. */
export function UpgradeNotice({ title, description, items }: UpgradeNoticeProps) {
  return (
    <div className="rounded-lg border border-line p-6">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-line text-brand">
        <Lock size={18} aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-h3">{title}</h2>
      <p className="mt-1.5 max-w-xl text-sm text-mute">{description}</p>
      {items && (
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-mute">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      )}
      {BILLING_ENABLED ? (
        <Link to="/app/plano" className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">
          Ver o plano Pro
        </Link>
      ) : (
        <p className="mt-4 text-xs text-faint">A contratação do plano Pro ainda não está disponível. Avisaremos quando for liberada.</p>
      )}
    </div>
  );
}
