/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        remed: {
          red: '#D32F2F',
          'red-dark': '#B71C1C',
          'red-light': '#EF5350',
          'blue-grey': '#546E7A',
          'blue-grey-light': '#78909C',
          'blue-grey-dark': '#37474F',
        },
      },
    },
  },
  plugins: [],
}
