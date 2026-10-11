import { describe, expect, it } from 'vitest';
import { mapDbError } from './dbErrors';

describe('mapDbError', () => {
  it.each([
    [{ message: 'MONTHLY_LIMIT_REACHED' }, 'limite de 100'],
    [{ message: 'HISTORY_LIMIT' }, 'últimos 3 meses'],
    [{ message: 'WORKSPACE_ALREADY_EXISTS' }, 'já tem um espaço'],
    [{ message: 'new row violates row-level security policy', code: '42501' }, 'permissão'],
    [{ message: 'FORBIDDEN' }, 'permissão'],
    [{ message: 'duplicate key', code: '23505' }, 'já foi registrado'],
    [{ message: 'fk', code: '23503' }, 'categoria'],
    [{ message: 'check', code: '23514' }, 'inválido'],
    [{ message: 'Failed to fetch' }, 'Sem conexão'],
    [{ message: 'algo novo' }, 'Algo deu errado'],
    [null, 'Algo deu errado'],
  ])('mapeia %j', (input, expected) => {
    expect(mapDbError(input)).toContain(expected);
  });
});
