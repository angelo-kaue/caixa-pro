import { Lock } from 'lucide-react';

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
      <p className="mt-4 text-xs text-faint">A contratação do plano Pro ainda não está disponível. Avisaremos quando for liberada.</p>
    </div>
  );
}
