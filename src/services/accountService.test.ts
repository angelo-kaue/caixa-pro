import { describe, expect, it } from 'vitest';
import { deleteErrorMessage, isDeletionConfirmed } from './accountService';

describe('isDeletionConfirmed', () => {
  it.each([['EXCLUIR', true], ['excluir', true], ['  Excluir  ', true], ['EXCLUI', false], ['', false], ['EXCLUIR TUDO', false], ['apagar', false]])('"%s" → %s', (t, ok) => {
    expect(isDeletionConfirmed(t)).toBe(ok);
  });
});

describe('deleteErrorMessage', () => {
  it('traduz os códigos conhecidos e tem mensagem padrão', () => {
    expect(deleteErrorMessage('CONFIRMATION_REQUIRED')).toContain('EXCLUIR');
    expect(deleteErrorMessage('PROVIDER_ERROR')).toContain('a conta não foi excluída');
    expect(deleteErrorMessage('XYZ')).toContain('Tente novamente');
    expect(deleteErrorMessage(null)).toContain('Tente novamente');
  });
});
