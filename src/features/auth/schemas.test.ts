import { describe, expect, it } from 'vitest';
import { forgotSchema, loginSchema, resetSchema, signupSchema } from './schemas';

describe('schemas de autenticação', () => {
  it('login: exige e-mail válido e senha preenchida', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'invalido', password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });

  it('login: aparamos espaços do e-mail', () => {
    const r = loginSchema.safeParse({ email: '  a@b.com ', password: 'x' });
    expect(r.success && r.data.email).toBe('a@b.com');
  });

  it.each([
    ['curta1', false],
    ['somenteletras', false],
    ['12345678', false],
    ['senhaboa1', true],
    ['A'.repeat(72 - 1) + '1', true],
    ['A'.repeat(72) + '1', false],
  ])('cadastro: senha "%s" válida=%s', (password, ok) => {
    const r = signupSchema.safeParse({ email: 'a@b.com', password, confirmPassword: password });
    expect(r.success).toBe(ok);
  });

  it('cadastro e redefinição: exigem senhas iguais', () => {
    expect(signupSchema.safeParse({ email: 'a@b.com', password: 'senhaboa1', confirmPassword: 'senhaboa2' }).success).toBe(false);
    expect(resetSchema.safeParse({ password: 'senhaboa1', confirmPassword: 'senhaboa1' }).success).toBe(true);
    expect(resetSchema.safeParse({ password: 'senhaboa1', confirmPassword: 'outra123' }).success).toBe(false);
  });

  it('esqueci a senha: valida e-mail', () => {
    expect(forgotSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
    expect(forgotSchema.safeParse({ email: '' }).success).toBe(false);
  });
});
