/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0B0F19',
          card: '#111827',
          border: '#1F2937',
          accent: '#3B82F6',
        },
        status: {
          up: '#10B981',
          degraded: '#F59E0B',
          down: '#EF4444',
          suspect: '#8B5CF6',
        }
      },
    },
  },
  plugins: [],
}
