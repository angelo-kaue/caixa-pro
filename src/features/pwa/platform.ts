export type Platform = 'ios-safari' | 'ios-other' | 'android' | 'desktop';

/** Detecta o aparelho/navegador a partir do user agent. No iPhone, só o Safari instala de forma confiável. */
export function detectPlatform(ua: string, platform = '', touchPoints = 0): Platform {
  const ios = /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && touchPoints > 1);
  if (ios) {
    const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram|Line\/|GSA\//.test(ua);
    return safari ? 'ios-safari' : 'ios-other';
  }
  return /Android/.test(ua) ? 'android' : 'desktop';
}

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
