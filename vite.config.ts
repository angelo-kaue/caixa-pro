import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/** Preenche o endereço do site nas tags de prévia (precisa ser absoluto). Na Netlify vem de URL; ou defina VITE_SITE_URL. */
function siteUrl(): Plugin {
  return {
    name: 'site-url',
    transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', (process.env.VITE_SITE_URL ?? process.env.URL ?? '').replace(/\/$/, '')),
  };
}

export default defineConfig({
  plugins: [react(), siteUrl()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { environment: 'node', include: ['src/**/*.test.{ts,tsx}', 'supabase/functions/**/*.test.ts'] },
});
