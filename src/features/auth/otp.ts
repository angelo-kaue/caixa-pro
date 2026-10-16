export type OtpType = 'recovery' | 'email' | 'signup';

/**
 * Lê o token de uso único dos links de e-mail do CaixaPro (?token_hash=...&type=...).
 * O token só é "gasto" quando o usuário clica no botão da página, e não quando um leitor de e-mail abre o link.
 */
export function readOtpParams(search: string, allowed: readonly OtpType[]): { tokenHash: string; type: OtpType } | null {
  const params = new URLSearchParams(search);
  const tokenHash = params.get('token_hash');
  const type = params.get('type');
  if (!tokenHash || !/^[A-Za-z0-9_-]{8,200}$/.test(tokenHash)) return null;
  if (!type || !allowed.includes(type as OtpType)) return null;
  return { tokenHash, type: type as OtpType };
}
