/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--color-background) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        muted: 'rgb(var(--color-surface-muted) / <alpha-value>)',
        ink: 'rgb(var(--color-text-primary) / <alpha-value>)',
        subtle: 'rgb(var(--color-text-secondary) / <alpha-value>)',
        line: 'rgb(var(--color-border) / <alpha-value>)',
        brand: 'rgb(var(--color-primary) / <alpha-value>)',
        'brand-soft': 'rgb(var(--color-primary-soft) / <alpha-value>)',
        hero: 'rgb(var(--color-hero) / <alpha-value>)',
      },
      borderRadius: {
        pingo: '1.125rem',
        'pingo-lg': '1.375rem',
      },
      boxShadow: {
        card: '0 16px 44px rgba(21, 21, 26, 0.07)',
        float: '0 20px 45px rgba(23, 23, 25, 0.14)',
      },
      transitionTimingFunction: {
        pingo: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
    },
  },
  plugins: [],
}
