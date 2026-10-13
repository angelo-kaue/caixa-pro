import { BarChart3, CalendarClock, Layers, Search, Target, Wallet, type LucideIcon } from 'lucide-react';

const steps = [
  { n: '01', title: 'Crie sua conta', text: 'Cadastro com e-mail e senha. Escolha se o espaço é pessoal ou do seu negócio.' },
  { n: '02', title: 'Registre o que aconteceu', text: 'Digite o lançamento em uma linha. O CaixaPro sugere valor, tipo e categoria para você confirmar.' },
  { n: '03', title: 'Veja para onde o dinheiro vai', text: 'Saldo, receitas, despesas e categorias calculados a partir dos seus registros.' },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="border-t border-line bg-canvas2 py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <h2 className="max-w-xl text-h1">Do primeiro lançamento ao panorama do mês</h2>
        <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
          {steps.map((s) => (
            <li key={s.n} className="border-t border-line2 pt-5">
              <span className="num text-sm font-bold text-brand">{s.n}</span>
              <h3 className="mt-3 text-h3">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mute">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const features: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Wallet, title: 'Receitas e despesas', text: 'Registre, edite e exclua movimentações com valores em formato brasileiro, sem erro de centavos.' },
  { icon: Search, title: 'Histórico com busca e filtros', text: 'Encontre qualquer lançamento por descrição, data, categoria ou tipo.' },
  { icon: Layers, title: 'Categorias automáticas', text: 'Regras e palavras-chave sugerem a categoria. Você corrige e o CaixaPro lembra a sua preferência.' },
  { icon: BarChart3, title: 'Indicadores reais', text: 'Saldo registrado, resultado do período e distribuição por categoria, sempre a partir dos seus dados.' },
  { icon: Target, title: 'Orçamentos e metas', text: 'Defina limites mensais por categoria e acompanhe o quanto já foi usado.' },
  { icon: CalendarClock, title: 'Contas recorrentes', text: 'Mantenha à vista o que se repete todo mês, inclusive contas a pagar e a receber no negócio.' },
];

export function Features() {
  return (
    <section id="funcionalidades" className="py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="text-h1">O essencial, bem feito</h2>
            <p className="mt-4 max-w-md text-mute">
              Sem planilha e sem jargão contábil. Cada recurso foi pensado para resolver uma dúvida simples: onde está o
              meu dinheiro?
            </p>
            <p className="mt-4 max-w-md text-sm text-faint">
              Alguns recursos, como orçamentos avançados, metas e recorrências, chegam por etapas e dependem do plano.
            </p>
          </div>
          <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {features.map(({ icon: Icon, title, text }) => (
              <div key={title}>
                <dt className="flex items-center gap-2.5 font-semibold">
                  <Icon size={18} className="text-brand" aria-hidden="true" />
                  {title}
                </dt>
                <dd className="mt-1.5 pl-[1.775rem] text-sm leading-relaxed text-mute">{text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

const personal = ['Salários e outras receitas', 'Despesas do dia a dia por categoria', 'Orçamentos mensais', 'Metas e contas recorrentes'];
const business = ['Vendas e despesas operacionais', 'Contas a pagar e a receber', 'Fluxo de caixa e resultado do período', 'Relatórios mensais'];

export function Audiences() {
  return (
    <section id="para-quem" className="border-t border-line bg-canvas2 py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <h2 className="max-w-2xl text-h1">Um produto, dois jeitos de usar</h2>
        <div className="mt-12 grid md:grid-cols-2">
          <div className="border-line pb-10 md:border-r md:pr-12">
            <p className="text-sm font-semibold text-brand">Finanças pessoais</p>
            <h3 className="mt-2 text-h2">Para a sua vida financeira</h3>
            <p className="mt-3 text-mute">Veja quanto entra, quanto sai e o que sobra no fim do mês, sem precisar entender de contabilidade.</p>
            <ul className="mt-6 space-y-2.5 text-sm">
              {personal.map((t) => (
                <li key={t} className="border-b border-line/70 pb-2.5">
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t border-line pt-10 md:border-t-0 md:pl-12 md:pt-0">
            <p className="text-sm font-semibold text-brand">Pequenos negócios</p>
            <h3 className="mt-2 text-h2">Para o caixa do seu negócio</h3>
            <p className="mt-3 text-mute">
              Acompanhe vendas, despesas e o que ainda vai pagar ou receber. O espaço do negócio é separado do pessoal.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm">
              {business.map((t) => (
                <li key={t} className="border-b border-line/70 pb-2.5">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-10 text-xs text-faint">
          O CaixaPro é uma ferramenta de organização financeira. Não é software contábil nem sistema de apuração fiscal.
        </p>
      </div>
    </section>
  );
}

const examples = [
  { input: '50 Uber', type: 'Despesa', category: 'Transporte', note: '' },
  { input: '32,90 iFood', type: 'Despesa', category: 'Alimentação', note: 'Pede confirmação' },
  { input: 'Recebi 2500 de salário', type: 'Receita', category: 'Salário', note: '' },
  { input: 'Venda de produto 350 reais', type: 'Receita', category: 'Vendas', note: '' },
];

export function SmartEntry() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <h2 className="text-h1">Registro inteligente: escreva do jeito que você fala</h2>
          <p className="mt-4 text-mute">
            O CaixaPro interpreta o texto e sugere valor, tipo, descrição e categoria. Quando houver dúvida, você confirma
            antes de salvar. A sugestão usa regras e palavras-chave em português, não inteligência artificial.
          </p>
        </div>
        <div className="mt-10 overflow-x-auto" tabIndex={0} role="region" aria-label="Exemplos de interpretação do registro inteligente">
          <table className="table-base min-w-[34rem]">
            <thead>
              <tr>
                <th>Você escreve</th>
                <th>Tipo</th>
                <th>Categoria sugerida</th>
                <th>Observação</th>
              </tr>
            </thead>
            <tbody>
              {examples.map((e) => (
                <tr key={e.input}>
                  <td className="font-medium">{e.input}</td>
                  <td className={e.type === 'Receita' ? 'text-income' : 'text-expense'}>{e.type}</td>
                  <td>{e.category}</td>
                  <td className="text-mute">{e.note || 'Sugestão direta'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
