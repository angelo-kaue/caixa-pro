import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = {
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
};
vi.mock('@/lib/supabase', () => ({ getSupabase: () => ({ auth }) }));
vi.stubGlobal('window', { location: { origin: 'https://app.exemplo.com' } });

const { requestPasswordReset, signIn, signUp } = await import('./authService');

beforeEach(() => {
  auth.signInWithPassword.mockReset().mockResolvedValue({ error: null });
  auth.signUp.mockReset().mockResolvedValue({ data: { session: null }, error: null });
  auth.resetPasswordForEmail.mockReset().mockResolvedValue({ error: null });
});

describe('verificação anti-robô nas chamadas de autenticação', () => {
  it('login envia o captchaToken quando existe', async () => {
    await signIn('a@b.com', 'senha', 'tok123');
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'senha', options: { captchaToken: 'tok123' } });
  });
  it('login sem token não envia opções', async () => {
    await signIn('a@b.com', 'senha');
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'senha' });
  });
  it('cadastro e recuperação enviam o captchaToken', async () => {
    await signUp('a@b.com', 'senha-forte-1', 'tokS');
    expect(auth.signUp.mock.calls[0]?.[0].options).toEqual({ emailRedirectTo: 'https://app.exemplo.com/auth/callback', captchaToken: 'tokS' });
    await requestPasswordReset('a@b.com', 'tokR');
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.com', { redirectTo: 'https://app.exemplo.com/redefinir-senha', captchaToken: 'tokR' });
  });
  it('erro de credencial vira mensagem genérica (sem revelar se o e-mail existe)', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { code: 'invalid_credentials', message: 'x' } });
    expect((await signIn('a@b.com', 'errada')).error).toBe('E-mail ou senha incorretos.');
  });
});
