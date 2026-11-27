/** Segundos de espera depois de erros de senha seguidos: livre até 4 erros; depois 30s, 60s, 120s, 240s e no máximo 300s. */
export function lockSeconds(consecutiveFailures: number): number {
  if (consecutiveFailures < 5) return 0;
  return Math.min(300, 30 * 2 ** (consecutiveFailures - 5));
}

const KEY = 'caixapro:login-throttle';

export interface ThrottleState {
  failures: number;
  /** Instante (ms) em que o botão libera de novo; 0 = livre. */
  until: number;
}

export function loadThrottle(now = Date.now()): ThrottleState {
  try {
    const raw = sessionStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<ThrottleState>) : {};
    const failures = Number.isInteger(parsed.failures) && (parsed.failures ?? 0) > 0 ? (parsed.failures as number) : 0;
    const until = typeof parsed.until === 'number' && parsed.until > now ? parsed.until : 0;
    return { failures, until };
  } catch {
    return { failures: 0, until: 0 };
  }
}

export function saveThrottle(state: ThrottleState): void {
  try {
    if (state.failures === 0) sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* sem armazenamento: o controle vale só enquanto a página estiver aberta */
  }
}

export function registerFailure(prev: ThrottleState, now = Date.now()): ThrottleState {
  const failures = prev.failures + 1;
  const wait = lockSeconds(failures);
  return { failures, until: wait > 0 ? now + wait * 1000 : 0 };
}
