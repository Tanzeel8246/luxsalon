import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
    './hooks/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          50:  'var(--color-gold-50)',
          100: 'var(--color-gold-100)',
          200: 'var(--color-gold-200)',
          300: 'var(--color-gold-300)',
          400: 'var(--color-gold-400)',
          500: 'var(--color-gold-500)',
          600: 'var(--color-gold-600)',
          700: 'var(--color-gold-700)',
          800: 'var(--color-gold-800)',
          900: 'var(--color-gold-900)',
          950: 'var(--color-gold-950)',
        },
        obsidian: {
          50:  'var(--color-obsidian-50)',
          100: 'var(--color-obsidian-100)',
          200: 'var(--color-obsidian-200)',
          300: 'var(--color-obsidian-300)',
          400: 'var(--color-obsidian-400)',
          500: 'var(--color-obsidian-500)',
          600: 'var(--color-obsidian-600)',
          700: 'var(--color-obsidian-700)',
          800: 'var(--color-obsidian-800)',
          900: 'var(--color-obsidian-900)',
          950: 'var(--color-obsidian-950)',
        },
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #D4AF37 0%, #F4E06B 50%, #D4AF37 100%)',
      },
      fontFamily: {
        sans:    ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-playfair)', 'Georgia', 'serif'],
      },
      boxShadow: {
        'gold':    '0 0 20px rgba(212, 175, 55, 0.3)',
        'gold-lg': '0 0 40px rgba(212, 175, 55, 0.4)',
      },
    },
  },
  plugins: [],
}

export default config
