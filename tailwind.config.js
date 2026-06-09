/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './admin/**/*.html',
    './assets/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        'bio': {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        'earth': {
          50: '#faf8f5',
          100: '#f0ebe3',
          200: '#e0d5c5',
          300: '#c9b8a3',
          400: '#b09a7e',
          500: '#9a8060',
          600: '#856a48',
          700: '#6d5639',
          800: '#5a4730',
          900: '#4a3b2a',
        }
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
