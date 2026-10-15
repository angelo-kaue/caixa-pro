import type { ReactNode } from 'react';
import { EllipsisVertical, Monitor, Share, SquarePlus } from 'lucide-react';
import type { Platform } from './platform';

const icon = (node: ReactNode) => <span className="mx-0.5 inline-flex translate-y-[3px] items-center text-fg">{node}</span>;

function Steps({ title, subtitle, steps, extra }: { title: string; subtitle: string; steps: ReactNode[]; extra?: ReactNode }) {
  return (
    <section className="border-t border-line py-8">
      <h2 className="text-h2">{title}</h2>
      <p className="mt-1 text-sm text-mute">{subtitle}</p>
      <ol className="mt-5 space-y-4">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-4">
            <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line2 text-sm font-bold text-brand">{i + 1}</span>
            <p className="pt-0.5 leading-relaxed text-mute">{s}</p>
          </li>
        ))}
      </ol>
      {extra && <div className="mt-5 text-sm text-faint">{extra}</div>}
    </section>
  );
}

const strong = (t: string) => <strong className="text-fg">{t}</strong>;

export function InstallGuide({ first }: { first?: Platform }) {
  const iphone = (
    <Steps
      key="iphone"
      title="No iPhone ou iPad"
      subtitle="Use o Safari. É o navegador azul com uma bússola."
      steps={[
        <>Abra o CaixaPro no {strong('Safari')}. Se você chegou por um link do Instagram, WhatsApp ou outro app, toque em {strong('Abrir no Safari')} (ou nos três pontinhos e em "Abrir no navegador").</>,
        <>Toque no botão {strong('Compartilhar')} {icon(<Share size={18} aria-hidden="true" />)} (um quadrado com uma seta para cima), na barra de baixo.</>,
        <>Role a lista e toque em {strong('Adicionar à Tela de Início')} {icon(<SquarePlus size={18} aria-hidden="true" />)}.</>,
        <>Toque em {strong('Adicionar')}, no canto superior direito. O ícone do CaixaPro aparece na sua tela inicial.</>,
      ]}
      extra={<>Se não achar a opção, role até o fim da lista de Compartilhar. Em alguns iPhones ela fica mais embaixo.</>}
    />
  );

  const android = (
    <Steps
      key="android"
      title="No Android"
      subtitle="Funciona melhor no Chrome."
      steps={[
        <>Abra o CaixaPro no {strong('Chrome')}.</>,
        <>Toque nos {strong('três pontinhos')} {icon(<EllipsisVertical size={18} aria-hidden="true" />)} no canto superior direito.</>,
        <>Toque em {strong('Instalar app')}. Em alguns celulares o nome é {strong('Adicionar à tela inicial')}.</>,
        <>Confirme em {strong('Instalar')} (ou {strong('Adicionar')}). O ícone aparece na tela inicial e na lista de apps.</>,
      ]}
      extra={<>Outros navegadores: no Edge, procure {strong('Adicionar ao telefone')}; no Firefox, {strong('Instalar')} ou {strong('Adicionar à tela')}; no Samsung Internet, procure {strong('Instalar')} ou {strong('Adicionar à tela inicial')} no menu.</>}
    />
  );

  const desktop = (
    <Steps
      key="desktop"
      title="No computador"
      subtitle="Chrome e Edge."
      steps={[
        <>Abra o CaixaPro e procure o ícone de instalar {icon(<Monitor size={18} aria-hidden="true" />)} no fim da barra de endereço.</>,
        <>Se não aparecer, abra o menu do navegador (três pontinhos) e escolha {strong('Instalar CaixaPro')}.</>,
      ]}
    />
  );

  const order = first === 'android' ? [android, iphone, desktop] : first === 'desktop' ? [desktop, iphone, android] : [iphone, android, desktop];
  return <div>{order}</div>;
}
