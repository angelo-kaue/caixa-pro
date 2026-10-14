import { describe, expect, it } from 'vitest';
import { LEGAL } from '@/config/legal';
import { getLegalDoc } from './legal';

const text = (doc: 'termos' | 'privacidade') => getLegalDoc(doc).sections.flatMap((s) => [s.title, ...s.paragraphs]).join('\n');

describe('textos legais', () => {
  it('não sobram marcadores sem preencher', () => {
    expect(text('termos')).not.toContain('{{');
    expect(text('privacidade')).not.toContain('{{');
  });

  it('usam os dados do responsável da configuração', () => {
    expect(text('termos')).toContain(LEGAL.controllerName);
    expect(text('privacidade')).toContain(LEGAL.contactEmail);
  });

  it('descrevem a cobrança como ela funciona', () => {
    const t = text('termos');
    expect(t).toContain('Mercado Pago');
    expect(t).toMatch(/Pix.*30 dias/s);
    expect(t).toContain('R$ 19,90');
    expect(t).toMatch(/renovação automática/);
    expect(t).toContain('7 dias');
  });

  it('a política cobre os pontos centrais da LGPD e os fornecedores reais', () => {
    const p = text('privacidade');
    for (const termo of ['LGPD', 'Supabase', 'Netlify', 'Mercado Pago', 'portabilidade', 'eliminação', 'Minha conta', '18 anos']) expect(p).toContain(termo);
    expect(p).toContain('Não vendemos seus dados');
  });

  it('não promete o que o produto não faz', () => {
    const all = text('termos') + text('privacidade');
    expect(all).not.toMatch(/sincroniza(mos|ção) com (o )?seu banco/i);
    expect(text('termos')).toContain('não é software contábil');
    expect(text('termos')).toContain('não está conectado à sua conta bancária');
  });
});
