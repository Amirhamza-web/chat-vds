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
        // Linear / Notion-inspired light palette
        surface: {
          // page + panels
          app: '#fafafa',
          card: '#ffffff',
          subtle: '#f4f4f5',
          muted: '#ececef',
        },
        line: '#e4e4e7',
        ink: {
          // text scale
          primary: '#18181b',
          secondary: '#3f3f46',
          tertiary: '#71717a',
          muted: '#a1a1aa',
        },
        accent: {
          DEFAULT: '#4f46e5',
          hover: '#4338ca',
          soft: '#eef2ff',
        },
        positive: '#10b981',
        danger: {
          DEFAULT: '#dc2626',
          soft: '#fef2f2',
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
