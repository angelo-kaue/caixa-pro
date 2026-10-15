import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { LandingPage } from './LandingPage';

function render(): string {
  return renderToString(
    <StaticRouter location="/">
      <LandingPage />
    </StaticRouter>,
  );
}

describe('LandingPage', () => {
  const html = render();

  it('renderiza o título principal e os CTAs apontando para o cadastro', () => {
    expect(html).toContain('Controle seu dinheiro. Entenda suas escolhas.');
    expect(html).toContain('href="/cadastro"');
    expect(html).toContain('href="/entrar"');
  });

  it('exibe os preços a partir da configuração central', () => {
    expect(html).toContain('R$ 0');
    expect(html).toContain('R$ 19,90');
    expect(html).toContain('R$ 79,90');
    expect(html).toContain('a partir de');
  });

  it('tem as âncoras de navegação e as seções correspondentes', () => {
    for (const id of ['como-funciona', 'funcionalidades', 'para-quem', 'planos', 'faq']) {
      expect(html).toContain(`id="${id}"`);
      expect(html).toContain(`href="#${id}"`);
    }
  });

  it('divulga a instalação no celular (landing, FAQ e rodapé)', () => {
    expect(html).toContain('Leve o CaixaPro no bolso');
    expect(html).toContain('href="/instalar"');
    expect(html).toContain('Posso usar no celular como um aplicativo?');
  });

  it('inclui links legais no rodapé', () => {
    expect(html).toContain('href="/termos"');
    expect(html).toContain('href="/privacidade"');
  });

  it('não contém depoimentos nem estatísticas inventadas', () => {
    expect(html.toLowerCase()).not.toMatch(/depoimento|milhares de usu|\d+\s*mil usu|avaliação \d/);
  });
});
