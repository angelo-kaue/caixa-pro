import { ChevronDown } from 'lucide-react';

const items = [
  {
    q: 'O CaixaPro é um software contábil?',
    a: 'Não. Ele organiza suas receitas e despesas para você ter clareza financeira. Não substitui contador nem faz apuração de impostos.',
  },
  {
    q: 'Ele se conecta ao meu banco?',
    a: 'Não. O saldo exibido é o saldo registrado a partir dos lançamentos que você faz, e pode diferir do saldo real da sua conta.',
  },
  {
    q: 'Posso separar finanças pessoais e do negócio?',
    a: 'Sim. Ao começar, você escolhe o tipo do espaço de trabalho. Movimentações pessoais e empresariais não se misturam.',
  },
  {
    q: 'O registro inteligente usa inteligência artificial?',
    a: 'Hoje ele usa regras e palavras-chave em português para sugerir valor, tipo e categoria. Você pode corrigir a sugestão e o CaixaPro lembra sua preferência.',
  },
  {
    q: 'Meus dados ficam isolados dos de outras pessoas?',
    a: 'Cada conta acessa apenas os dados do seu próprio espaço de trabalho, e essa regra é aplicada no banco de dados, não só na interface.',
  },
  {
    q: 'Posso usar no celular como um aplicativo?',
    a: 'Sim. O CaixaPro funciona no navegador do celular e pode ser adicionado à tela inicial: no iPhone, pelo Safari (Compartilhar, Adicionar à Tela de Início); no Android, pelo Chrome (três pontinhos, Instalar app). Ele abre em tela cheia, mas não é baixado de uma loja de aplicativos.',
  },
  {
    q: 'Preciso de cartão de crédito para usar o Free?',
    a: 'Não. O cadastro pede apenas e-mail e senha.',
  },
];

export function Faq() {
  return (
    <section id="faq" className="py-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr]">
        <h2 className="text-h1">Perguntas frequentes</h2>
        <div className="divide-y divide-line border-y border-line">
          {items.map((i) => (
            <details key={i.q} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold [&::-webkit-details-marker]:hidden">
                {i.q}
                <ChevronDown size={18} className="shrink-0 text-mute transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="pb-4 pr-8 text-sm leading-relaxed text-mute">{i.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
