import { formatDateBR } from './dates';
import { formatCentsForInput } from './money';

const SEP = ';'; // Excel em português espera ponto e vírgula
const FORMULA_START = /^[=+\-@\t\r]/;

/** Escapa uma célula: bloqueia injeção de fórmula (=, +, -, @) e aplica aspas quando necessário. */
export function csvEscape(value: string): string {
  let cell = value;
  if (FORMULA_START.test(cell)) cell = `'${cell}`;
  if (/[";\r\n]/.test(cell)) cell = `"${cell.replace(/"/g, '""')}"`;
  return cell;
}

/** CSV com BOM (para o Excel reconhecer UTF-8) e quebras de linha CRLF. */
export function toCsv(rows: string[][]): string {
  return '\uFEFF' + rows.map((r) => r.map(csvEscape).join(SEP)).join('\r\n') + '\r\n';
}

export interface ExportTransaction {
  date: string;
  kind: 'income' | 'expense';
  description: string;
  category: string;
  payment: string;
  amountCents: number;
}

export function transactionsToCsv(items: ExportTransaction[]): string {
  const header = ['Data', 'Tipo', 'Descrição', 'Categoria', 'Forma de pagamento', 'Valor (R$)'];
  const rows = items.map((t) => [
    formatDateBR(t.date),
    t.kind === 'income' ? 'Receita' : 'Despesa',
    t.description,
    t.category,
    t.payment,
    formatCentsForInput(t.amountCents),
  ]);
  return toCsv([header, ...rows]);
}

export interface ExportCategoryRow {
  category: string;
  kind: 'income' | 'expense';
  currentCents: number;
  previousCents: number;
}

export function categoriesToCsv(items: ExportCategoryRow[]): string {
  const header = ['Categoria', 'Tipo', 'Período atual (R$)', 'Período anterior (R$)'];
  const rows = items.map((c) => [
    c.category,
    c.kind === 'income' ? 'Receita' : 'Despesa',
    formatCentsForInput(c.currentCents),
    formatCentsForInput(c.previousCents),
  ]);
  return toCsv([header, ...rows]);
}
