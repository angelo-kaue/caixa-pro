import { describe, expect, it } from 'vitest';
import { detectPlatform } from './platform';

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1',
  iphoneInstagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21A329 Instagram 300.0.0.0',
  ipadDesktopClass: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
};

describe('detectPlatform', () => {
  it('iPhone: Safari instala; outros navegadores e navegadores de apps (Instagram) não', () => {
    expect(detectPlatform(UA.iphoneSafari)).toBe('ios-safari');
    expect(detectPlatform(UA.iphoneChrome)).toBe('ios-other');
    expect(detectPlatform(UA.iphoneInstagram)).toBe('ios-other');
  });
  it('iPad que se identifica como Mac (tem toque) é iOS', () => {
    expect(detectPlatform(UA.ipadDesktopClass, 'MacIntel', 5)).toBe('ios-safari');
    expect(detectPlatform(UA.macSafari, 'MacIntel', 0)).toBe('desktop');
  });
  it('Android e computador', () => {
    expect(detectPlatform(UA.androidChrome)).toBe('android');
    expect(detectPlatform(UA.windows)).toBe('desktop');
  });
});
