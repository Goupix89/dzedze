/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        guin: {
          dark:       '#0C0805',
          card:       '#1A1008',
          border:     '#3D2010',
          terracotta: '#C1440E',
          'terra-light': '#E05A1E',
          gold:       '#D4A017',
          'gold-light':'#F0BC30',
          green:      '#2D6A4F',
          'green-light':'#3D8A65',
          indigo:     '#1E2D5A',
          cream:      '#F5ECD7',
          'cream-dim':'#A08060',
          red:        '#8B1A0A',
        },
      },
      fontFamily: {
        display: ['Georgia', 'Cambria', 'serif'],
      },
      backgroundImage: {
        'kente-stripe': 'repeating-linear-gradient(90deg, #C1440E 0px, #C1440E 8px, #D4A017 8px, #D4A017 16px, #2D6A4F 16px, #2D6A4F 24px, #D4A017 24px, #D4A017 32px)',
      },
    },
  },
  plugins: [],
};
