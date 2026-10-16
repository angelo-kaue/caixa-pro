import { describe, expect, it } from 'vitest';
import { readOtpParams } from './otp';

describe('readOtpParams', () => {
  it('lê token e tipo permitidos', () => {
    expect(readOtpParams('?token_hash=abc12345def&type=recovery', ['recovery'])).toEqual({ tokenHash: 'abc12345def', type: 'recovery' });
    expect(readOtpParams('?type=email&token_hash=pkce_abc-123_XYZ', ['email', 'signup'])).toEqual({ tokenHash: 'pkce_abc-123_XYZ', type: 'email' });
  });
  it('recusa tipo não permitido, token ausente ou com formato estranho', () => {
    expect(readOtpParams('?token_hash=abc12345def&type=email', ['recovery'])).toBeNull();
    expect(readOtpParams('?type=recovery', ['recovery'])).toBeNull();
    expect(readOtpParams('?token_hash=curto&type=recovery', ['recovery'])).toBeNull();
    expect(readOtpParams('?token_hash=<script>alert(1)</script>&type=recovery', ['recovery'])).toBeNull();
    expect(readOtpParams('', ['recovery'])).toBeNull();
  });
});
