/** Senhas muito comuns (com 10+ caracteres e número, que seriam aceitas só pelo tamanho). Comparação sem maiúsculas. */
const COMMON = new Set([
  '1234567890', '12345678910', '123456789a', '123456abcd', '12345abcde', '1q2w3e4r5t', '1q2w3e4r5t6y', 'q1w2e3r4t5',
  'qwerty12345', 'qwertyuiop1', 'abc1234567', 'abcd123456', 'senha12345', 'senha123456', 'senha1234567', 'senha@12345',
  'minhasenha1', 'minhasenha12', 'minhasenha123', 'mudar12345', 'brasil12345', 'brasil2026', 'password123', 'password1234',
  'password12345', 'admin12345', 'admin123456', 'welcome1234', 'iloveyou123', 'caixapro123', 'caixapro1234', 'caixapro2026',
  'corinthians1', 'flamengo123', 'palmeiras12', 'saopaulo123', 'gabriel1234', 'felipe12345',
]);

export function isCommonPassword(password: string): boolean {
  return COMMON.has(password.toLowerCase());
}

/** A senha contém a parte inicial do e-mail (4+ letras)? Ex.: ana.silva@x.com com a senha "ana.silva2026". */
export function containsEmailName(password: string, email: string): boolean {
  const local = email.split('@')[0]?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
  return local.length >= 4 && password.toLowerCase().replace(/[^a-z0-9]/g, '').includes(local);
}
