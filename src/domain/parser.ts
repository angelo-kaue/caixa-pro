import { suggestCategory, type Kind, type UserRule } from './categorizer';
import { addDays, isValidYMD, splitISO, ymdToISO } from './dates';
import { parseMoneyToCents } from './money';
import { normalize } from './text';

export type PaymentMethod = 'pix' | 'credit_card' | 'debit_card' | 'cash' | 'bank_slip' | 'transfer' | 'other';

export interface ParsedEntry {
  /** null quando nenhum valor válido foi encontrado. */
  amountCents: number | null;
  kind: Kind;
  description: string;
  categoryName: string | null;
  occurredOn: string;
  paymentMethod: PaymentMethod | null;
  /** true quando há ambiguidade: a interface deve mostrar a interpretação antes de salvar. */
  needsConfirmation: boolean;
  reasons: string[];
}

export interface ParseOptions {
  today: string;
  userRules?: UserRule[];
}

const isAlnum = (ch: string | undefined): boolean => ch !== undefined && /[\p{L}\d]/u.test(ch);

/* ----------------------------- datas ----------------------------- */

interface DateResult {
  text: string;
  date: string | null;
  reason: string | null;
}

function extractDate(text: string, today: string): DateResult {
  const t = splitISO(today);

  const rel = /\b(anteontem|ontem|hoje)\b/i.exec(text);
  if (rel) {
    const w = (rel[1] ?? '').toLowerCase();
    const delta = w === 'anteontem' ? -2 : w === 'ontem' ? -1 : 0;
    return { text: text.replace(rel[0], ' '), date: addDays(today, delta), reason: null };
  }

  const dm = /(?<![\d/])(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?(?![\d/])/.exec(text);
  if (dm) {
    const d = Number(dm[1]);
    const m = Number(dm[2]);
    const yRaw = dm[3];
    const explicitYear = yRaw !== undefined;
    let y = explicitYear ? (yRaw.length === 2 ? 2000 + Number(yRaw) : Number(yRaw)) : t.y;
    if (isValidYMD(y, m, d)) {
      let iso = ymdToISO(y, m, d);
      let reason: string | null = null;
      if (!explicitYear && iso > today) {
        y -= 1;
        if (!isValidYMD(y, m, d)) return { text, date: null, reason: null };
        iso = ymdToISO(y, m, d);
        reason = 'Data sem ano: considerei o ano passado.';
      }
      return { text: text.replace(dm[0], ' '), date: iso, reason };
    }
  }

  const dia = /\bdia\s+(\d{1,2})\b/i.exec(text);
  if (dia) {
    const d = Number(dia[1]);
    let y = t.y;
    let m = t.m;
    let reason: string | null = null;
    if (d > t.d) {
      m -= 1;
      if (m === 0) {
        m = 12;
        y -= 1;
      }
      reason = 'Esse dia ainda não chegou neste mês: considerei o mês passado.';
    }
    if (isValidYMD(y, m, d)) {
      return { text: text.replace(dia[0], ' '), date: ymdToISO(y, m, d), reason };
    }
  }

  return { text, date: null, reason: null };
}

/* -------------------------- forma de pagamento -------------------------- */

const PAYMENT_PATTERNS: [PaymentMethod, RegExp][] = [
  ['credit_card', /(?:\b(?:no|na|via|com|pelo|pela|de|em)\s+)?\b(?:cart[aã]o\s+de\s+cr[eé]dito|cr[eé]dito)\b/i],
  ['debit_card', /(?:\b(?:no|na|via|com|pelo|pela|de|em)\s+)?\bd[eé]bito\b/i],
  ['pix', /(?:\b(?:no|na|via|com|pelo|pela|de|em)\s+)?\bpix\b/i],
  ['cash', /(?:\b(?:no|na|via|com|pelo|pela|de|em)\s+)?\b(?:dinheiro|esp[eé]cie)\b/i],
  ['bank_slip', /(?:\b(?:no|na|via|com|pelo|pela|de|em)\s+)?\bboleto\b/i],
  ['transfer', /(?:\b(?:no|na|via|com|pelo|pela|de|em)\s+)?\b(?:transfer[eê]ncia|ted)\b/i],
];

function extractPayment(text: string): { text: string; method: PaymentMethod | null } {
  for (const [method, re] of PAYMENT_PATTERNS) {
    const m = re.exec(text);
    if (m) {
      const stripped = text.replace(m[0], ' ');
      // Se sobrar só o meio de pagamento (ex.: "Pix 50"), ele continua sendo a descrição.
      return { text: /\p{L}/u.test(stripped) ? stripped : text, method };
    }
  }
  return { text, method: null };
}

/* ------------------------------- valor ------------------------------- */

interface AmountCandidate {
  index: number;
  raw: string;
  cents: number;
  marked: boolean;
  hasDecimals: boolean;
}

const AMOUNT_RE =
  /(r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)(\s*(?:reais|real|contos?|pilas?)\b)?/gi;

function findAmounts(text: string): AmountCandidate[] {
  const found: AmountCandidate[] = [];
  AMOUNT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = AMOUNT_RE.exec(text)) !== null) {
    const number = m[2] ?? '';
    const start = m.index + (m[1]?.length ?? 0);
    const end = start + number.length;
    // Não considera números colados em letras/dígitos (ex.: "99pop").
    if (isAlnum(text[start - 1]) && !m[1]) continue;
    if (isAlnum(text[end]) && !m[3]) continue;
    const cents = parseMoneyToCents(number);
    if (cents === null || cents <= 0) continue;
    found.push({
      index: m.index,
      raw: m[0],
      cents,
      marked: Boolean(m[1] || m[3]),
      hasDecimals: /[.,]\d{1,2}$/.test(number),
    });
  }
  return found;
}

function pickAmount(cands: AmountCandidate[]): { chosen: AmountCandidate | null; ambiguous: boolean } {
  if (cands.length === 0) return { chosen: null, ambiguous: false };
  if (cands.length === 1) return { chosen: cands[0] ?? null, ambiguous: false };
  const marked = cands.filter((c) => c.marked);
  if (marked.length === 1) return { chosen: marked[0] ?? null, ambiguous: false };
  const pool = marked.length > 1 ? marked : cands;
  const withDecimals = pool.filter((c) => c.hasDecimals);
  const finalPool = withDecimals.length === 1 ? withDecimals : pool;
  const chosen = [...finalPool].sort((a, b) => b.cents - a.cents)[0] ?? null;
  return { chosen, ambiguous: true };
}

/* -------------------------------- tipo -------------------------------- */

const STRONG_INCOME = /\b(recebi|recebido|recebida|recebimento|vendi|ganhei)\b/;
const STRONG_EXPENSE = /\b(paguei|gastei|comprei|pago|gasto)\b/;
const WEAK_INCOME = /\b(salario|venda|vendas|receita|entrada|deposito|rendimentos?|reembolso|freela|freelance|cashback|dividendos?|bonus|comissao|honorarios)\b/;
const WEAK_EXPENSE = /\b(conta|boleto|compra|despesa|fatura|parcela|mensalidade|aluguel|pagamento|pagar)\b/;

function detectKind(text: string): { kind: Kind; ambiguous: boolean } {
  const n = normalize(text);
  const si = STRONG_INCOME.test(n);
  const se = STRONG_EXPENSE.test(n);
  if (si && !se) return { kind: 'income', ambiguous: false };
  if (se && !si) return { kind: 'expense', ambiguous: false };
  if (si && se) return { kind: 'expense', ambiguous: true };
  const wi = WEAK_INCOME.test(n);
  const we = WEAK_EXPENSE.test(n);
  if (wi && !we) return { kind: 'income', ambiguous: false };
  if (wi && we) return { kind: 'expense', ambiguous: true };
  return { kind: 'expense', ambiguous: false };
}

/* ------------------------------ descrição ------------------------------ */

function cleanDescription(text: string): string {
  let s = text
    .replace(/\b(recebi|recebido|recebida|paguei|gastei|comprei|vendi|ganhei)\b/gi, ' ')
    .replace(/r\$/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  s = s.replace(/^[-–—:,;.\s]+|[-–—:,;.\s]+$/g, '');
  for (;;) {
    const next = s.replace(/^(?:de|do|da|dos|das|com|no|na|em|para|pra|por)\s+/i, '');
    if (next === s) break;
    s = next;
  }
  s = s.replace(/\s+/g, ' ').trim().slice(0, 140);
  const first = s.charAt(0);
  if (first && s === s.toLowerCase() && first !== first.toUpperCase()) s = first.toUpperCase() + s.slice(1);
  return s;
}

/* ---------------------------- função principal ---------------------------- */

export function parseQuickEntry(input: string, options: ParseOptions): ParsedEntry {
  const reasons: string[] = [];
  let text = input.replace(/\s+/g, ' ').trim();

  const dateRes = extractDate(text, options.today);
  text = dateRes.text;
  if (dateRes.reason) reasons.push(dateRes.reason);

  const pay = extractPayment(text);
  text = pay.text;

  const { chosen, ambiguous: amountAmbiguous } = pickAmount(findAmounts(text));
  if (chosen) text = text.replace(chosen.raw, ' ');
  if (amountAmbiguous) reasons.push('Encontrei mais de um número: confira o valor.');

  const kindRes = detectKind(`${input}`);
  if (kindRes.ambiguous) reasons.push('Não ficou claro se é receita ou despesa.');

  let description = cleanDescription(text);

  // Primeiro pela descrição limpa; se nada casar, tenta o texto completo (ex.: o verbo "vendi" indica Vendas).
  let suggestion = suggestCategory(description || input, kindRes.kind, options.userRules ?? []);
  if (suggestion.category === null) suggestion = suggestCategory(input, kindRes.kind, options.userRules ?? []);
  if (suggestion.category === null) reasons.push('Escolha uma categoria.');
  else if (suggestion.confirm) reasons.push('Confirme a categoria sugerida.');

  if (!description) description = suggestion.category ?? (kindRes.kind === 'income' ? 'Receita' : 'Despesa');

  return {
    amountCents: chosen ? chosen.cents : null,
    kind: kindRes.kind,
    description,
    categoryName: suggestion.category,
    occurredOn: dateRes.date ?? options.today,
    paymentMethod: pay.method,
    needsConfirmation: reasons.length > 0,
    reasons,
  };
}
