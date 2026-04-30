/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Discord-inspired neutral palette
        bg: {
          900: '#202225',
          800: '#2f3136',
          700: '#36393f',
          600: '#40444b',
          500: '#4f545c',
        },
        accent: {
          DEFAULT: '#5865f2',
          hover: '#4752c4',
        },
        text: {
          primary: '#dcddde',
          muted: '#b9bbbe',
          subtle: '#8e9297',
        },
      },
    },
  },
  plugins: [],
};
