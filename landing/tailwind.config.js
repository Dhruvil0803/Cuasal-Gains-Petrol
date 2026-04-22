/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          orange:  '#F47920',
          dark:    '#D4621A',
          light:   '#FEF3E8',
          border:  '#FBCFA4',
          mid:     '#FB923C',
          gray:    '#58595B',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
