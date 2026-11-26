// Regras dos lembretes: mensagens, horário do "dia" no Brasil e validações. Sem dependência de Deno.

export type Slot = 'noon' | 'evening' | 'night';

export interface ReminderMessage {
  title: string;
  body: string;
}

const MESSAGES: Record<Slot, string[]> = {
  noon: [
    'Registrou o gasto do almoço? Leva 10 segundos.',
    'Anota aí o que já gastou hoje, antes de esquecer.',
    'Um minutinho agora e o seu mês fica em dia.',
    'Passou algum gasto hoje? Registre no CaixaPro.',
  ],
  evening: [
    'Teve compra hoje? Registre agora, enquanto você lembra.',
    'Mercado, transporte, lanche... já anotou tudo?',
    'Pequenos gastos somam. Registre os de hoje.',
    'Entrou algum dinheiro hoje? Registre também.',
  ],
  night: [
    'Fechando o dia: algum gasto ficou sem registro?',
    'Antes de dormir, confira se registrou tudo de hoje.',
    'Um último olhar: o dia de hoje está completo no CaixaPro?',
    'Registre o que faltou de hoje e termine o dia com as contas em ordem.',
  ],
};

export function isSlot(value: unknown): value is Slot {
  return value === 'noon' || value === 'evening' || value === 'night';
}

/** Número do dia (no horário de Brasília) para variar a mensagem a cada dia sem repetir seguido. */
function dayNumber(now: Date): number {
  return Math.floor((now.getTime() - 3 * 3_600_000) / 86_400_000);
}

export function pickMessage(slot: Slot, now: Date): ReminderMessage {
  const list = MESSAGES[slot];
  return { title: 'CaixaPro', body: list[dayNumber(now) % list.length] ?? list[0] ?? '' };
}

/** 00:00 de hoje em Brasília (UTC-3, sem horário de verão desde 2019), como instante UTC. */
export function startOfDayBRT(now: Date): Date {
  return new Date((dayNumber(now) * 86_400_000) + 3 * 3_600_000);
}

export function constantTimeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** Só enviamos para os serviços de push dos navegadores conhecidos (evita usar o servidor para chamar endereços arbitrários). */
export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.port !== '') return false;
  return /(^|\.)(googleapis\.com|mozilla\.com|push\.apple\.com|notify\.windows\.com)$/.test(url.hostname);
}
