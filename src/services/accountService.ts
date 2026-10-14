import { getSupabase } from '@/lib/supabase';
import { errorInfo } from './billingService';

/** Confirmação por digitação ("EXCLUIR"), sem diferenciar maiúsculas e ignorando espaços nas pontas. */
export const isDeletionConfirmed = (text: string): boolean => text.trim().toUpperCase() === 'EXCLUIR';

const DELETE_MESSAGES: Record<string, string> = {
  CONFIRMATION_REQUIRED: 'Digite EXCLUIR para confirmar.',
  PROVIDER_ERROR: 'Não conseguimos cancelar a sua assinatura no Mercado Pago agora, então a conta não foi excluída. Tente de novo em instantes.',
  UNAUTHENTICATED: 'Sua sessão expirou. Entre novamente.',
};

export const deleteErrorMessage = (code: string | null): string => (code && DELETE_MESSAGES[code]) || 'Não foi possível excluir a conta agora. Tente novamente em instantes.';

/** Todos os dados da conta em um objeto (portabilidade, LGPD). */
export async function exportMyData(): Promise<unknown> {
  const { data, error } = await getSupabase().rpc('export_my_data');
  if (error) throw error;
  return data;
}

export async function deleteAccount(confirm: string): Promise<void> {
  const { error } = await getSupabase().functions.invoke('delete-account', { body: { confirm } });
  if (error) throw new Error(deleteErrorMessage((await errorInfo(error)).code));
  // A sessão local deixa de valer: limpa só o armazenamento do navegador (o usuário já não existe no servidor).
  await getSupabase().auth.signOut({ scope: 'local' }).catch(() => undefined);
}
