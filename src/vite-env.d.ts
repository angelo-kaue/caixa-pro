/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_BILLING_ENABLED?: string;
  readonly VITE_CARD_ENABLED?: string;
  readonly VITE_VAPID_PUBLIC_KEY?: string;
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
