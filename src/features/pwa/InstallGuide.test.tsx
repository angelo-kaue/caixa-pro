import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { InstallPage } from '@/pages/InstallPage';
import { PasswordInput } from '@/components/ui/PasswordInput';

const page = renderToString(
  <StaticRouter location="/instalar">
    <InstallPage />
  </StaticRouter>,
);

describe('guia de instalação', () => {
  it('explica o iPhone passo a passo, pelo Safari', () => {
    for (const t of ['No iPhone ou iPad', 'Safari', 'Compartilhar', 'Adicionar à Tela de Início', 'Adicionar']) expect(page).toContain(t);
    expect(page).toContain('Abrir no Safari');
  });
  it('explica o Android (Chrome) e outros navegadores', () => {
    for (const t of ['No Android', 'Chrome', 'três pontinhos', 'Instalar app', 'Adicionar à tela inicial']) expect(page).toContain(t);
  });
  it('é honesto: não é baixado de loja', () => {
    expect(page).toContain('Não é baixado de uma loja de aplicativos');
  });
});

describe('PasswordInput', () => {
  const html = renderToString(<PasswordInput label="Senha" />);
  it('começa oculto, com botão acessível para mostrar', () => {
    expect(html).toContain('type="password"');
    expect(html).toContain('aria-label="Mostrar senha"');
    expect(html).toContain('aria-pressed="false"');
  });
  it('o botão não envia o formulário', () => {
    expect(html).toMatch(/<button[^>]*type="button"/);
  });
});
