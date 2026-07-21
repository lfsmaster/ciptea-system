/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef7ff', 100: '#d9edff', 500: '#1769aa', 700: '#0b3f78', 900: '#062d62'
        }
      },
      boxShadow: { card: '0 10px 30px rgba(15, 23, 42, 0.08)' }
    }
  },
  plugins: []
};
