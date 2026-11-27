import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadThrottle, lockSeconds, registerFailure, saveThrottle } from './throttle';

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('lockSeconds', () => {
  it.each([
    [0, 0],
    [4, 0],
    [5, 30],
    [6, 60],
    [7, 120],
    [8, 240],
    [9, 300],
    [30, 300],
  ])('%i erros seguidos => %i s', (failures, seconds) => expect(lockSeconds(failures)).toBe(seconds));
});

describe('registerFailure', () => {
  it('só bloqueia a partir do 5º erro', () => {
    let s = { failures: 0, until: 0 };
    for (let i = 0; i < 4; i++) s = registerFailure(s, 1_000);
    expect(s).toEqual({ failures: 4, until: 0 });
    s = registerFailure(s, 1_000);
    expect(s).toEqual({ failures: 5, until: 1_000 + 30_000 });
  });
});

describe('armazenamento', () => {
  it('guarda e recupera, descartando bloqueios já vencidos', () => {
    vi.stubGlobal('sessionStorage', fakeStorage());
    saveThrottle({ failures: 6, until: 5_000 });
    expect(loadThrottle(1_000)).toEqual({ failures: 6, until: 5_000 });
    expect(loadThrottle(9_000)).toEqual({ failures: 6, until: 0 });
    saveThrottle({ failures: 0, until: 0 });
    expect(loadThrottle(1_000)).toEqual({ failures: 0, until: 0 });
  });
  it('ignora conteúdo corrompido e funciona sem armazenamento', () => {
    const st = fakeStorage();
    st.setItem('caixapro:login-throttle', '{"failures":"abc","until":"x"}');
    vi.stubGlobal('sessionStorage', st);
    expect(loadThrottle()).toEqual({ failures: 0, until: 0 });
    vi.unstubAllGlobals();
    expect(() => saveThrottle({ failures: 3, until: 0 })).not.toThrow();
  });
});
