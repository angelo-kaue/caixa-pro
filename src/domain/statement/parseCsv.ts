import type { CsvMapping, CsvPrepared, ParsedRow } from './types';
import { MAX_AMOUNT_CENTS } from '@/domain/money';
import { cleanText, normalizeText, parseAmountToCents, parseDate } from './util';

function countOutsideQuotes(line: string, delim: string): number {
  let inQ = false;
  let n = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line.charAt(i);
    if (ch === '"') inQ = !inQ;
    else if (ch === delim && !inQ) n++;
  }
  return n;
}

export function detectDelimiter(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .slice(0, 30);
  let best = ';';
  let bestScore = 0;
  for (const c of [';', ',', '\t', '|']) {
    const freq = new Map<number, number>();
    for (const l of lines) {
      const n = countOutsideQuotes(l, c);
      if (n > 0) freq.set(n, (freq.get(n) ?? 0) + 1);
    }
    let score = 0;
    for (const [n, f] of freq) score = Math.max(score, n * f);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

export function tokenizeCsv(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQ = false;
  const endRow = () => {
    row.push(field);
    field = '';
    if (row.some((c) => c.trim() !== '')) rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (inQ) {
      if (ch === '"') {
        if (text.charAt(i + 1) === '"') {
          field += '"';
          i++;
        } else inQ = false;
      } else field += ch;
    } else if (ch === '"' && field === '') {
      inQ = true;
    } else if (ch === delim) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text.charAt(i + 1) === '\n') i++;
      endRow();
    } else field += ch;
  }
  endRow();
  return rows;
}

function findIndex(norm: string[], patterns: RegExp[], exclude: number[] = []): number {
  for (const p of patterns) {
    const i = norm.findIndex((h, idx) => !exclude.includes(idx) && p.test(h));
    if (i >= 0) return i;
  }
  return -1;
}

function tryMapping(headers: string[]): CsvMapping | null {
  const norm = headers.map(normalizeText);
  const date = findIndex(norm, [/^(data|date)\b/, /\b(data|date)\b/]);
  if (date < 0) return null;
  const description = findIndex(
    norm,
    [/descri/, /historico/, /estabelecimento/, /^title/, /lancamento/, /^memo/, /detalhe/, /^nome/],
    [date],
  );
  if (description < 0) return null;
  const amount = findIndex(norm, [/^valor\b/, /^amount/, /^montante/, /\bvalor\b/], [date, description]);
  const debit = findIndex(norm, [/debito/, /saida/, /^debit/], [date, description]);
  const credit = findIndex(norm, [/credito/, /entrada/, /^credit/], [date, description]);
  if (amount < 0 && (debit < 0 || credit < 0)) return null;
  const id = findIndex(norm, [/identificador/, /^id$/, /^documento/, /^nsu/, /^codigo/, /^n documento/], [
    date,
    description,
  ]);
  return {
    date,
    description,
    amount: amount >= 0 ? amount : null,
    debit: amount < 0 && debit >= 0 ? debit : null,
    credit: amount < 0 && credit >= 0 ? credit : null,
    id: id >= 0 ? id : null,
  };
}

export function prepareCsv(text: string): CsvPrepared {
  const table = tokenizeCsv(text, detectDelimiter(text));
  if (table.length === 0) throw new Error('O arquivo CSV está vazio.');
  const scan = Math.min(table.length, 40);
  for (let i = 0; i < scan; i++) {
    const mapping = tryMapping(table[i] ?? []);
    if (mapping) return { table, headerIndex: i, mapping };
  }
  // Sem cabeçalho reconhecido: usa a linha mais larga como palpite para o mapeamento manual.
  let headerIndex = 0;
  let widest = 0;
  for (let i = 0; i < scan; i++) {
    const w = (table[i] ?? []).length;
    if (w > widest) {
      widest = w;
      headerIndex = i;
    }
  }
  return { table, headerIndex, mapping: null };
}

function cell(row: string[], i: number | null): string {
  return i === null ? '' : (row[i] ?? '');
}

export function extractCsvRows(
  table: string[][],
  headerIndex: number,
  mapping: CsvMapping,
): { rows: ParsedRow[]; skipped: number } {
  const rows: ParsedRow[] = [];
  let skipped = 0;
  for (const row of table.slice(headerIndex + 1)) {
    const date = parseDate(cell(row, mapping.date));
    const description = cleanText(cell(row, mapping.description));
    let cents: number | null = null;
    if (mapping.amount !== null) {
      cents = parseAmountToCents(cell(row, mapping.amount));
    } else {
      const d = parseAmountToCents(cell(row, mapping.debit));
      const c = parseAmountToCents(cell(row, mapping.credit));
      if (d !== null || c !== null) cents = Math.abs(c ?? 0) - Math.abs(d ?? 0);
    }
    if (!date || cents === null || cents === 0 || Math.abs(cents) > MAX_AMOUNT_CENTS || /^saldo\b/.test(normalizeText(description))) {
      skipped++;
      continue;
    }
    const externalId = cleanText(cell(row, mapping.id));
    rows.push({
      date,
      description: description || '(sem descrição)',
      cents,
      ...(externalId ? { externalId } : {}),
    });
  }
  return { rows, skipped };
}
