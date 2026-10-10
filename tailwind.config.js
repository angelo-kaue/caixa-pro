/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#050505',
        canvas2: '#0B0B0B',
        surface: '#111111',
        surface2: '#171717',
        line: '#262626',
        line2: '#363636',
        brand: { DEFAULT: '#22C55E', dark: '#16A34A', soft: 'rgba(34,197,94,0.12)' },
        fg: '#FFFFFF',
        mute: '#A3A3A3',
        faint: '#8A8A8A',
        income: '#22C55E',
        expense: '#F87171',
        warn: '#F59E0B',
      },
      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: { sm: '6px', md: '8px', lg: '12px' },
      fontSize: {
        display: ['3.5rem', { lineHeight: '1.04', letterSpacing: '-0.035em', fontWeight: '800' }],
        h1: ['2.25rem', { lineHeight: '1.1', letterSpacing: '-0.025em', fontWeight: '700' }],
        h2: ['1.5rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' }],
        h3: ['1.125rem', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '600' }],
      },
    },
  },
  plugins: [],
};
