/** Chave pública do Cloudflare Turnstile. Sem ela, a verificação não aparece (e o CAPTCHA fica desligado no Supabase). */
export const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '').trim();
export const captchaEnabled = TURNSTILE_SITE_KEY !== '';
