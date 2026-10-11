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
  if (msg.includes('BUDGET_LIMIT_REACHED')) {
    return `O plano Free permite até ${PLANS.free.limits.maxActiveBudgets} orçamentos ativos. Pause ou exclua um para criar outro.`;
  }
  if (msg.includes('BUDGET_ALREADY_EXISTS')) return 'Já existe um orçamento para essa categoria. Edite o que já existe.';
  if (msg.includes('BUDGET_NEEDS_EXPENSE_CATEGORY')) return 'Orçamentos só podem ser criados para categorias de despesa.';
  if (msg.includes('FEATURE_NOT_AVAILABLE')) return 'Este recurso faz parte do plano Pro.';
  if (msg.includes('BUSINESS_ONLY')) return 'Contas a pagar e a receber estão disponíveis só para espaços de negócio.';
  if (msg.includes('ALREADY_PAID')) return 'Esta conta já foi baixada.';
  if (msg.includes('NOT_PAID')) return 'Esta conta ainda não foi baixada.';
  if (msg.includes('BILL_PAID_LOCKED')) return 'Contas já baixadas não podem ser alteradas. Desfaça a baixa para editar.';
  if (msg.includes('CATEGORY_KIND_MISMATCH')) return 'A categoria escolhida não combina com o tipo (receita ou despesa).';
  if (msg.includes('INVALID_DATE')) return 'Informe uma data válida.';
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
