/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        light: {
          bg: '#F3F4F6',        // Very light neutral gray
          card: '#FFFFFF',      // White
          border: '#E5E7EB',    // Soft neutral gray
          textMain: '#1F2937',  // Near-black / charcoal
          textMuted: '#6B7280', // Muted gray
          accent: '#4F46E5',    // Indigo for active controls
        },
        status: {
          up: '#10B981',        // Green accent
          degraded: '#F59E0B',  // Amber accent
          down: '#EF4444',      // Red accent
          paused: '#9CA3AF',    // Gray
        }
      },
    },
  },
  plugins: [],
}
