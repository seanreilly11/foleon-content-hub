import type { Config } from 'tailwindcss';

// Note: Tailwind v4 reads theme from @theme{} in index.css via @tailwindcss/vite.
// This file is kept for reference and IDE intellisense.
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#e0eaff',
          500: '#3b63f7',
          600: '#2248e5',
          700: '#1a38c0',
        },
        surface: '#f8f9fc',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
};
export default config;
