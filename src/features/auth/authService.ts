import { getSupabase } from '@/lib/supabase';
import { mapAuthError } from './authErrors';

export interface AuthResult {
  error: string | null;
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const { error } = await getSupabase().auth.signInWithPassword({ email, password });
  return { error: error ? mapAuthError(error) : null };
}

/** needsConfirmation=true também cobre e-mail já cadastrado (o Supabase não sinaliza), evitando enumeração de contas. */
export async function signUp(email: string, password: string): Promise<AuthResult & { needsConfirmation: boolean }> {
  const { data, error } = await getSupabase().auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
  });
  if (error) return { error: mapAuthError(error), needsConfirmation: false };
  return { error: null, needsConfirmation: data.session === null };
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/redefinir-senha`,
  });
  return { error: error ? mapAuthError(error) : null };
}

export async function updatePassword(password: string): Promise<AuthResult> {
  const { error } = await getSupabase().auth.updateUser({ password });
  return { error: error ? mapAuthError(error) : null };
}

export async function signOut(): Promise<void> {
  await getSupabase().auth.signOut();
}
