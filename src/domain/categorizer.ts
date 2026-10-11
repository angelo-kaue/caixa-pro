import { escapeRegExp, normalize } from './text';

export type Kind = 'income' | 'expense';

export interface DefaultRule {
  keyword: string;
  category: string;
  /** Sugestão que sempre pede confirmação (ex.: iFood pode não ser comida). */
  confirm?: boolean;
}

export interface UserRule {
  keyword: string;
  category: string;
}

export interface CategorySuggestion {
  category: string | null;
  source: 'user' | 'default' | null;
  confirm: boolean;
}

const r = (category: string, keywords: string[], confirm = false): DefaultRule[] =>
  keywords.map((keyword) => ({ keyword, category, confirm }));

const EXPENSE_RULES: DefaultRule[] = [
  ...r('Transporte', ['uber', '99pop', '99 taxi', 'taxi', 'onibus', 'metro', 'gasolina', 'combustivel', 'etanol', 'estacionamento', 'pedagio', 'passagem', 'bilhete unico', 'cabify', 'indrive']),
  ...r('Alimentação', ['ifood'], true),
  ...r('Alimentação', ['rappi', 'restaurante', 'lanche', 'almoco', 'jantar', 'padaria', 'cafe', 'pizza', 'pizzaria', 'hamburguer', 'acai', 'mercado', 'supermercado', 'feira', 'acougue', 'hortifruti', 'sorvete', 'marmita', 'comida']),
  ...r('Compras', ['mercado livre', 'amazon', 'shopee', 'magalu', 'shein', 'americanas', 'roupa', 'tenis', 'sapato', 'loja', 'presente', 'eletronico']),
  ...r('Moradia', ['aluguel', 'condominio', 'iptu', 'reforma', 'moveis', 'financiamento imobiliario']),
  ...r('Contas e serviços', ['internet', 'energia', 'luz', 'agua', 'telefone', 'celular', 'gas', 'conta de luz', 'conta de agua', 'tv a cabo', 'seguro', 'taxa', 'tarifa']),
  ...r('Saúde', ['farmacia', 'remedio', 'medico', 'consulta', 'exame', 'dentista', 'plano de saude', 'academia', 'psicologo', 'hospital']),
  ...r('Lazer', ['cinema', 'netflix', 'spotify', 'disney', 'hbo', 'show', 'bar', 'cerveja', 'viagem', 'jogo', 'steam', 'parque', 'balada', 'streaming']),
  ...r('Educação', ['curso', 'faculdade', 'mensalidade', 'escola', 'livro', 'udemy', 'apostila']),
  ...r('Fornecedores', ['fornecedor', 'fornecedores', 'materia prima', 'estoque', 'insumo', 'insumos']),
  ...r('Marketing', ['anuncio', 'anuncios', 'trafego pago', 'google ads', 'meta ads', 'impulsionamento']),
  ...r('Equipamentos', ['equipamento', 'notebook', 'maquina', 'impressora']),
];

const INCOME_RULES: DefaultRule[] = [
  ...r('Salário', ['salario', 'holerite', 'contracheque']),
  ...r('Vendas', ['venda', 'vendas', 'vendi']),
  ...r('Outras receitas', ['rendimento', 'rendimentos', 'reembolso', 'freela', 'freelance', 'cashback', 'dividendo', 'dividendos', 'bonus', 'comissao', 'honorarios']),
];

const byLengthDesc = <T extends { keyword: string }>(rules: T[]): T[] =>
  [...rules].sort((a, b) => b.keyword.length - a.keyword.length);

const DEFAULTS: Record<Kind, DefaultRule[]> = {
  expense: byLengthDesc(EXPENSE_RULES.map((x) => ({ ...x, keyword: normalize(x.keyword) }))),
  income: byLengthDesc(INCOME_RULES.map((x) => ({ ...x, keyword: normalize(x.keyword) }))),
};

function containsWord(haystack: string, keyword: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(keyword)}([^a-z0-9]|$)`).test(haystack);
}

/** Sugere a categoria: preferências do usuário primeiro, depois as regras padrão. */
export function suggestCategory(description: string, kind: Kind, userRules: UserRule[] = []): CategorySuggestion {
  const text = normalize(description);

  for (const rule of byLengthDesc(userRules.map((u) => ({ ...u, keyword: normalize(u.keyword) })))) {
    if (rule.keyword && containsWord(text, rule.keyword)) {
      return { category: rule.category, source: 'user', confirm: false };
    }
  }
  for (const rule of DEFAULTS[kind]) {
    if (containsWord(text, rule.keyword)) {
      return { category: rule.category, source: 'default', confirm: rule.confirm === true };
    }
  }
  return { category: null, source: null, confirm: false };
}

/** Chave para guardar a preferência do usuário: a descrição normalizada (previsível e específica). */
export function ruleKeywordFromDescription(description: string): string {
  return normalize(description)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
    .trim();
}
