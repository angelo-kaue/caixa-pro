import { describe, expect, it } from 'vitest';
import { mapAuthError } from './authErrors';

describe('mapAuthError', () => {
  it.each([
    [{ code: 'invalid_credentials' }, 'E-mail ou senha incorretos.'],
    [{ message: 'Invalid login credentials' }, 'E-mail ou senha incorretos.'],
    [{ code: 'email_not_confirmed' }, 'Confirme seu e-mail'],
    [{ code: 'weak_password' }, 'senha mais forte'],
    [{ code: 'same_password' }, 'diferente da atual'],
    [{ code: 'over_email_send_rate_limit' }, 'Muitas tentativas'],
    [{ code: 'otp_expired' }, 'expirou'],
    [{ name: 'AuthRetryableFetchError', message: 'Failed to fetch' }, 'Sem conexão'],
    [{ code: 'qualquer_coisa_nova' }, 'Algo deu errado'],
    [null, 'Algo deu errado'],
    ['texto solto', 'Algo deu errado'],
  ])('mapeia %j', (input, expected) => {
    expect(mapAuthError(input)).toContain(expected);
  });

  it('não revela se o e-mail já está cadastrado', () => {
    const msg = mapAuthError({ code: 'user_already_exists', message: 'User already registered' });
    expect(msg.toLowerCase()).not.toContain('já está cadastrado');
    expect(msg.toLowerCase()).not.toContain('already');
  });
});
