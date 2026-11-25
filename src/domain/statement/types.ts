import type { Kind } from '@/domain/categorizer';
import type { PaymentMethod } from '@/domain/parser';

/** Linha lida do arquivo. cents: positivo = entrada, negativo = saída. */
export interface ParsedRow {
  date: string; // YYYY-MM-DD
  description: string;
  cents: number;
  externalId?: string;
}

export interface ParsedStatement {
  rows: ParsedRow[];
  accountId?: string;
  skipped: number;
}

export interface CsvMapping {
  date: number;
  description: number;
  amount: number | null;
  debit: number | null;
  credit: number | null;
  id: number | null;
}

export interface CsvPrepared {
  table: string[][];
  headerIndex: number;
  mapping: CsvMapping | null;
}

export type LoadedFile =
  | { kind: 'ofx'; statement: ParsedStatement }
  | { kind: 'csv'; prepared: CsvPrepared };

/** Lançamento que já existe no banco. cents: valor absoluto; key: idempotency_key (se houver). */
export interface ExistingTx {
  id: string;
  date: string;
  kind: Kind;
  cents: number;
  key: string | null;
}

export type RowStatus = 'new' | 'duplicate' | 'possible';

export interface ReviewRow {
  id: string;
  date: string;
  description: string;
  kind: Kind;
  cents: number; // sempre positivo
  /** Chave determinística (UUID) usada como idempotency_key: a trava anti-duplicidade. */
  key: string;
  status: RowStatus;
  selected: boolean;
  categoryId: string | null;
  paymentMethod: PaymentMethod | null;
}
