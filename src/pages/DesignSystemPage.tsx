import { Receipt } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Select } from '@/components/ui/Field';
import { Logo } from '@/components/ui/Logo';
import { Money } from '@/components/ui/Money';

const swatches: [string, string][] = [
  ['canvas', '#050505'],
  ['canvas2', '#0B0B0B'],
  ['surface', '#111111'],
  ['line', '#262626'],
  ['brand', '#22C55E'],
  ['brand-dark', '#16A34A'],
  ['mute', '#A3A3A3'],
  ['expense', '#F87171'],
  ['warn', '#F59E0B'],
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-8">
      <h2 className="mb-5 text-sm font-semibold uppercase tracking-wide text-faint">{title}</h2>
      {children}
    </section>
  );
}

/** Página só de desenvolvimento (não existe no build de produção). */
export default function DesignSystemPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Logo size={32} />
      <p className="mt-3 text-mute">Sistema de design: tokens e componentes base.</p>

      <Section title="Cores">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {swatches.map(([name, hex]) => (
            <div key={name}>
              <div className="h-12 rounded-md border border-line" style={{ background: hex }} />
              <p className="mt-1.5 text-xs text-mute">{name}</p>
              <p className="num text-xs text-faint">{hex}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tipografia">
        <p className="text-display">Clareza sobre seu dinheiro</p>
        <p className="mt-4 text-h1">Título 1</p>
        <p className="mt-2 text-h2">Título 2</p>
        <p className="mt-2 text-h3">Título 3</p>
        <p className="mt-2 text-mute">Texto secundário com contraste adequado.</p>
      </Section>

      <Section title="Botões">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Começar grátis</Button>
          <Button variant="secondary">Conhecer a plataforma</Button>
          <Button variant="ghost">Cancelar</Button>
          <Button variant="danger">Excluir</Button>
          <Button loading>Salvando</Button>
          <Button disabled>Desabilitado</Button>
        </div>
      </Section>

      <Section title="Campos">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Valor" placeholder="0,00" hint="Use vírgula para os centavos." />
          <Input label="Descrição" defaultValue="Uber" error="Informe uma descrição válida." />
          <Select label="Categoria" defaultValue="transporte">
            <option value="transporte">Transporte</option>
            <option value="alimentacao">Alimentação</option>
          </Select>
        </div>
      </Section>

      <Section title="Valores e estados">
        <div className="flex flex-wrap items-center gap-6">
          <Money cents={250000} tone="income" />
          <Money cents={-3290} tone="expense" />
          <Money cents={123456} />
          <Badge tone="income">Receita</Badge>
          <Badge tone="expense">Despesa</Badge>
          <Badge tone="warn">Atenção</Badge>
          <Badge>Neutro</Badge>
        </div>
      </Section>

      <Section title="Tabela">
        <table className="table-base">
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th className="text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="num text-mute">10/10</td>
              <td>Uber</td>
              <td className="text-mute">Transporte</td>
              <td className="text-right">
                <Money cents={-5000} tone="expense" />
              </td>
            </tr>
            <tr>
              <td className="num text-mute">05/10</td>
              <td>Salário</td>
              <td className="text-mute">Salário</td>
              <td className="text-right">
                <Money cents={250000} tone="income" />
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="Estado vazio">
        <div className="rounded-lg border border-line">
          <EmptyState
            icon={Receipt}
            title="Nenhum lançamento ainda"
            description="Registre sua primeira receita ou despesa para ver seus indicadores."
            action={<Button>Registrar lançamento</Button>}
          />
        </div>
      </Section>
    </main>
  );
}
