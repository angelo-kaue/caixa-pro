import type { ParsedRow, ParsedStatement } from './types';
import { MAX_AMOUNT_CENTS } from '@/domain/money';
import { cleanText, parseAmountToCents, parseDate } from './util';

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&');
}

function tag(block: string, name: string): string {
  const m = new RegExp(`<${name}>\\s*([^<\\r\\n]*)`, 'i').exec(block);
  return decodeEntities((m?.[1] ?? '').trim());
}

/** Lê OFX 1.x (SGML, sem tags de fechamento) e 2.x (XML). Serve para conta corrente e cartão. */
export function parseOfx(text: string): ParsedStatement {
  const accountId = tag(text, 'ACCTID') || undefined;
  const parts = text.split(/<STMTTRN>/i).slice(1);
  if (parts.length === 0) throw new Error('Nenhuma transação encontrada no arquivo OFX.');

  const rows: ParsedRow[] = [];
  let skipped = 0;
  for (const part of parts) {
    const end = part.search(/<\/STMTTRN>|<\/BANKTRANLIST>|<\/STMTRS>|<\/CCSTMTRS>/i);
    const block = end >= 0 ? part.slice(0, end) : part;
    const date = parseDate(tag(block, 'DTPOSTED'));
    const cents = parseAmountToCents(tag(block, 'TRNAMT'), { dotDecimal: true });
    if (!date || cents === null || cents === 0 || Math.abs(cents) > MAX_AMOUNT_CENTS) {
      skipped++;
      continue;
    }
    const name = cleanText(tag(block, 'NAME'));
    const memo = cleanText(tag(block, 'MEMO'));
    const description =
      name && memo && name.toLowerCase() !== memo.toLowerCase()
        ? memo.toLowerCase().includes(name.toLowerCase())
          ? memo
          : `${name} - ${memo}`
        : name || memo || '(sem descrição)';
    const externalId = tag(block, 'FITID');
    rows.push({ date, description, cents, ...(externalId ? { externalId } : {}) });
  }
  return { rows, ...(accountId ? { accountId } : {}), skipped };
}
