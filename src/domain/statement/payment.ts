import type { Kind } from '@/domain/categorizer';
import type { PaymentMethod } from '@/domain/parser';
import { normalizeText } from './util';

/** Palpite conservador da forma de pagamento a partir da descrição do extrato. */
export function guessPayment(description: string, kind: Kind): PaymentMethod | null {
  const t = normalizeText(description);
  if (/\bpix\b/.test(t)) return 'pix';
  if (/\b(boleto|pagamento de titulo)\b/.test(t)) return 'bank_slip';
  if (/\b(ted|doc|transferencia|transf)\b/.test(t)) return 'transfer';
  if (kind === 'expense') {
    if (/\b(cartao de credito|compra no credito|fatura)\b/.test(t)) return 'credit_card';
    if (/\b(cartao de debito|compra no debito|compra debito)\b/.test(t)) return 'debit_card';
  }
  return null;
}
