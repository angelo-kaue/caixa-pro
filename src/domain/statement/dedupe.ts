import type { Kind } from '@/domain/categorizer';
import { guessPayment } from './payment';
import { hashToUuid } from './hash';
import type { ExistingTx, ParsedRow, ReviewRow, RowStatus } from './types';
import { normalizeText } from './util';

const DAY_MS = 86_400_000;
const dayNum = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);

export interface ReviewOptions {
  invert: boolean;
  accountId?: string;
  /** Sugere a categoria (id) para a linha; devolve null se não souber. */
  categorize?: (description: string, kind: Kind) => string | null;
}

/**
 * Anti-duplicidade em duas camadas:
 * 1) "duplicate": a mesma chave já foi importada (FITID/ID do banco, ou data+valor+descrição).
 * 2) "possible": sobrou no banco um lançamento de mesmo tipo e valor, com data até 2 dias de diferença
 *    (típico de lançamento digitado à mão ou importado por outro formato).
 * Duas linhas idênticas no mesmo arquivo continuam válidas: ganham sufixo #1, #2... na chave.
 * Linhas "new" vêm marcadas; "duplicate" e "possible" vêm desmarcadas, e o usuário decide.
 */
export function buildReview(rows: ParsedRow[], existing: ExistingTx[], opts: ReviewOptions): ReviewRow[] {
  const acct = opts.accountId ?? '';
  const seen = new Map<string, number>();
  const prepared = rows.map((r) => {
    const cents = opts.invert ? -r.cents : r.cents;
    const base = r.externalId
      ? `id:${acct}:${r.externalId}`
      : `h:${r.date}|${cents}|${normalizeText(r.description).slice(0, 60)}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return { r, cents, key: hashToUuid(n > 0 ? `${base}#${n}` : base) };
  });

  const byKey = new Map<string, ExistingTx>();
  for (const e of existing) if (e.key) byKey.set(e.key, e);
  const consumed = new Set<string>();
  for (const p of prepared) {
    const e = byKey.get(p.key);
    if (e) consumed.add(e.id);
  }

  const pool = new Map<string, { day: number }[]>();
  for (const e of existing) {
    if (consumed.has(e.id)) continue;
    const k = `${e.kind}|${e.cents}`;
    const list = pool.get(k) ?? [];
    list.push({ day: dayNum(e.date) });
    pool.set(k, list);
  }

  return prepared.map((p, i) => {
    const kind: Kind = p.cents >= 0 ? 'income' : 'expense';
    const abs = Math.abs(p.cents);
    let status: RowStatus = 'new';
    if (byKey.has(p.key)) {
      status = 'duplicate';
    } else {
      const list = pool.get(`${kind}|${abs}`);
      if (list) {
        const d = dayNum(p.r.date);
        const idx = list.findIndex((e) => Math.abs(e.day - d) <= 2);
        if (idx >= 0) {
          list.splice(idx, 1);
          status = 'possible';
        }
      }
    }
    return {
      id: String(i),
      date: p.r.date,
      description: p.r.description,
      kind,
      cents: abs,
      key: p.key,
      status,
      selected: status === 'new',
      categoryId: opts.categorize?.(p.r.description, kind) ?? null,
      paymentMethod: guessPayment(p.r.description, kind),
    };
  });
}
