import { colors } from './src/theme/colors';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: 'var(--canvas)',
        surface: {
          DEFAULT: 'var(--surface-DEFAULT)',
          dim: 'var(--surface-dim)',
          lowest: 'var(--surface-lowest)',
          low: 'var(--surface-low)',
          card: 'var(--surface-card)',
          container: 'var(--surface-container)',
          high: 'var(--surface-high)',
          highest: 'var(--surface-highest)',
          bright: 'var(--surface-bright)',
          border: 'var(--surface-border)',
          borderSubdued: 'var(--surface-border-subdued)',
          borderProminent: 'var(--surface-border-prominent)',
        },
        'on-surface': 'var(--on-surface)',
        'on-surface-variant': 'var(--on-surface-variant)',
        'on-surface-muted': 'var(--on-surface-muted)',
        primary: {
          DEFAULT: colors.primary.DEFAULT,
          light: colors.primary.light,
          emerald: colors.primary.emerald,
          container: colors.primary.container,
          'on-primary': colors.primary.onPrimary,
          'on-container': colors.primary.onContainer,
        },
        secondary: {
          DEFAULT: colors.secondary.DEFAULT,
          amber: colors.secondary.amber,
          container: colors.secondary.container,
          'on-secondary': colors.secondary.onSecondary,
        },
        tertiary: {
          DEFAULT: colors.tertiary.DEFAULT,
          coral: colors.tertiary.coral,
          container: colors.tertiary.container,
          'on-tertiary': colors.tertiary.onTertiary,
        },
        status: colors.status,
        timing: colors.timing,
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'glow-primary': '0 0 16px rgba(78, 222, 163, 0.35)',
        'glow-secondary': '0 0 16px rgba(255, 185, 95, 0.35)',
        'glow-tertiary': '0 0 16px rgba(239, 68, 68, 0.35)',
      }
    },
  },
  plugins: [],
}
