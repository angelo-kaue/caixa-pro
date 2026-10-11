import { PLANS } from '@/config/plans';

/** Traduz erros do banco/PostgREST (inclusive os lançados pelos triggers) para mensagens claras. */
export function mapDbError(error: unknown): string {
  const e = (error ?? {}) as { message?: string; code?: string; name?: string };
  const msg = e.message ?? '';

  if (msg.includes('MONTHLY_LIMIT_REACHED')) {
    return `Você atingiu o limite de ${PLANS.free.limits.maxTransactionsPerMonth} lançamentos deste mês no plano Free.`;
  }
  if (msg.includes('HISTORY_LIMIT')) {
    return `Essa data está fora do histórico do seu plano (últimos ${PLANS.free.limits.historyMonths} meses).`;
  }
  if (msg.includes('WORKSPACE_ALREADY_EXISTS')) return 'Você já tem um espaço de trabalho configurado.';
  if (msg.includes('INVALID_NAME')) return 'Informe um nome de 1 a 80 caracteres.';
  if (msg.includes('INVALID_BALANCE')) return 'O saldo inicial informado é inválido.';
  if (msg.includes('INVALID_PERIOD')) return 'O período informado é inválido.';
  if (msg.includes('FORBIDDEN') || msg.includes('row-level security') || e.code === '42501') {
    return 'Você não tem permissão para essa operação.';
  }
  if (e.code === '23505') return 'Este lançamento já foi registrado.';
  if (e.code === '23503') return 'A categoria escolhida não é válida para este espaço de trabalho.';
  if (e.code === '23514') return 'Algum dos valores informados é inválido. Confira e tente novamente.';
  if (/failed to fetch|network|load failed/i.test(msg) || e.name === 'TypeError') {
    return 'Sem conexão com o servidor. Verifique sua internet e tente novamente.';
  }
  return 'Algo deu errado. Tente novamente em instantes.';
}
