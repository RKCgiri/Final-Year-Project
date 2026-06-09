/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          green: '#00C853',
          'green-dark': '#00A843',
          'green-light': '#69F0AE',
        },
        dark: {
          900: '#0A0F0D',
          800: '#0D1410',
          700: '#111A14',
          600: '#162019',
          500: '#1E2E24',
          400: '#243528',
          300: '#2E4235',
        },
        accent: {
          teal: '#00E5CC',
          gold: '#FFD700',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
        display: ['Syne', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'fadeInUp': 'fadeInUp 0.6s ease-out forwards',
        'slideInLeft': 'slideInLeft 0.5s ease-out forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px #00C853, 0 0 10px #00C853' },
          '100%': { boxShadow: '0 0 20px #00C853, 0 0 40px #00C853' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(rgba(0,200,83,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,200,83,0.05) 1px, transparent 1px)',
        'radial-green': 'radial-gradient(circle at center, rgba(0,200,83,0.15) 0%, transparent 70%)',
      },
      backgroundSize: {
        'grid': '40px 40px',
      },
    },
  },
  plugins: [],
}
