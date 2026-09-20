import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // RUTHEX brand palette — see src/app/brand-guide or README
        brand: {
          // RUTHEX Green #0B5D3B — primary, navbar, hero, primary CTA, footer
          DEFAULT: '#0B5D3B',
          50:  '#E8F4ED',
          100: '#C6E4D2',
          200: '#9DD4B1',
          300: '#6FC28C',
          400: '#3FAE6A',
          500: '#1F9A4F',  // tint for hover/active
          600: '#0B5D3B',  // PRIMARY
          700: '#0A4F32',
          800: '#08412A',
          900: '#063322',
          950: '#032013',
        },
        emerald: {
          DEFAULT: '#16A34A',
          500: '#16A34A',  // SECONDARY accent — links, hover, success, icons
          600: '#128A3D',
        },
        gold: {
          DEFAULT: '#D4AF37',  // ACCENT — use sparingly (CTA accents, icons, underlines, numbers)
          500: '#D4AF37',
          600: '#B8932A',
        },
        ink: {
          DEFAULT: '#1F2937',  // TEXT — charcoal
          500: '#1F2937',
          600: '#1F2937',
          700: '#111827',
        },
        canvas: '#FFFFFF',
        rule: '#E5E7EB',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(11,93,59,0.06), 0 1px 1px rgba(11,93,59,0.04)',
        lift: '0 4px 14px rgba(11,93,59,0.10), 0 1px 2px rgba(11,93,59,0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
