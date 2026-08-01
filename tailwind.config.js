/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        glow: '0 0 0 1px rgba(103, 232, 249, 0.15), 0 20px 60px rgba(8, 145, 178, 0.12)',
      },
    },
  },
  plugins: [],
}