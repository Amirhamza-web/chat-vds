/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        surface: {
          app: 'rgb(var(--surface-app) / <alpha-value>)',
          card: 'rgb(var(--surface-card) / <alpha-value>)',
          subtle: 'rgb(var(--surface-subtle) / <alpha-value>)',
          muted: 'rgb(var(--surface-muted) / <alpha-value>)',
        },
        line: 'rgb(var(--line) / <alpha-value>)',
        ink: {
          primary: 'rgb(var(--ink-primary) / <alpha-value>)',
          secondary: 'rgb(var(--ink-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--ink-tertiary) / <alpha-value>)',
          muted: 'rgb(var(--ink-muted) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          hover: 'rgb(var(--accent-hover) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)',
        },
        positive: 'rgb(var(--positive) / <alpha-value>)',
        danger: {
          DEFAULT: 'rgb(var(--danger) / <alpha-value>)',
          soft: 'rgb(var(--danger-soft) / <alpha-value>)',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06)',
        pop: '0 8px 24px rgba(15, 23, 42, 0.12)',
      },
    },
  },
  plugins: [],
};
