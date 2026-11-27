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
    ['senhaboa1', false], // 9 caracteres
    ['somenteletras', false],
    ['1234567890', false],
    ['Senha12345', false], // senha comum
    ['cavalo-azul7', true],
    ['senhaboa12', true],
    ['A'.repeat(72 - 1) + '1', true],
    ['A'.repeat(72) + '1', false],
  ])('cadastro: senha "%s" válida=%s', (password, ok) => {
    const r = signupSchema.safeParse({ email: 'a@b.com', password, confirmPassword: password });
    expect(r.success).toBe(ok);
  });

  it('cadastro e redefinição: exigem senhas iguais', () => {
    expect(signupSchema.safeParse({ email: 'a@b.com', password: 'senhaboa12', confirmPassword: 'senhaboa22' }).success).toBe(false);
    expect(resetSchema.safeParse({ password: 'senhaboa12', confirmPassword: 'senhaboa12' }).success).toBe(true);
    expect(resetSchema.safeParse({ password: 'senhaboa12', confirmPassword: 'outra12345' }).success).toBe(false);
  });

  it('cadastro: a senha não pode conter o nome do e-mail', () => {
    const base = { email: 'ana.silva@exemplo.com', confirmPassword: '' };
    const ok = (password: string) => signupSchema.safeParse({ ...base, password, confirmPassword: password }).success;
    expect(ok('anasilva2026x')).toBe(false);
    expect(ok('Ana.Silva-2026')).toBe(false);
    expect(ok('cavalo-azul7')).toBe(true);
    // nomes curtos (menos de 4 letras) não bloqueiam
    expect(signupSchema.safeParse({ email: 'ana@exemplo.com', password: 'ana-cavalo-7', confirmPassword: 'ana-cavalo-7' }).success).toBe(true);
  });

  it('esqueci a senha: valida e-mail', () => {
    expect(forgotSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
    expect(forgotSchema.safeParse({ email: '' }).success).toBe(false);
  });
});
