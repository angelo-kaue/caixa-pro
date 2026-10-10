/** Leitura validada das variáveis de ambiente públicas. Nunca coloque segredos aqui. */
function required(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  const value = import.meta.env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Variável de ambiente ausente: ${name}. Copie .env.example para .env.local e preencha.`);
  }
  return value.trim();
}

export const env = {
  get supabaseUrl(): string {
    return required('VITE_SUPABASE_URL');
  },
  get supabaseAnonKey(): string {
    return required('VITE_SUPABASE_ANON_KEY');
  },
};
