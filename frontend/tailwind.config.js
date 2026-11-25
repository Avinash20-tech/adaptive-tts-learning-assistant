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
        // Luxury Black & Gold Palette
        lux: {
          bg: '#090A0C',
          secondary: '#101114',
          surface: '#17181C',
          elevated: '#1D1E22',
          card: '#141519',
          gold: '#C8A96B',
          champagne: '#E4D1A1',
          goldMuted: '#9E834D',
          goldDark: '#66532B',
          text: '#F5F1E8',
          textMuted: '#A5A29B',
          textDim: '#706E69',
          border: '#302D27',
          borderLight: '#423E36',
          borderSubtle: '#22211E',
        },
        // Compatibility bindings
        brand: {
          50: '#FAF7F0',
          100: '#F4EEDA',
          200: '#E4D1A1',
          300: '#D6BD85',
          400: '#C8A96B',
          500: '#B89656',
          600: '#A17F42',
          700: '#836531',
          800: '#644C24',
          900: '#463417',
          950: '#2A1E0B',
        },
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Playfair Display', 'Georgia', 'serif'],
        sans: ['Manrope', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'luxury': '0 20px 50px -15px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(200, 169, 107, 0.08)',
        'luxury-hover': '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 25px rgba(200, 169, 107, 0.15), 0 0 0 1px rgba(200, 169, 107, 0.3)',
        'gold-glow': '0 0 35px -5px rgba(200, 169, 107, 0.25)',
        'gold-glow-sm': '0 0 15px -2px rgba(200, 169, 107, 0.18)',
        'gold-glow-lg': '0 0 60px -10px rgba(200, 169, 107, 0.3)',
        'inner-metal': 'inset 0 1px 1px 0 rgba(228, 209, 161, 0.25), inset 0 -1px 1px 0 rgba(0, 0, 0, 0.6)',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #E4D1A1 0%, #C8A96B 50%, #8B703C 100%)',
        'gold-shimmer': 'linear-gradient(90deg, #C8A96B 0%, #F5F1E8 50%, #C8A96B 100%)',
        'dark-metallic': 'linear-gradient(180deg, #1D1E22 0%, #101114 100%)',
        'surface-gradient': 'linear-gradient(180deg, rgba(29, 30, 34, 0.7) 0%, rgba(16, 17, 20, 0.7) 100%)',
      },
      animation: {
        'shimmer': 'shimmer 4s ease-in-out infinite alternate',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'gold-wave': 'goldWave 1.8s ease-in-out infinite alternate',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '100% 50%' },
        },
        goldWave: {
          '0%': { transform: 'scaleY(0.15)', opacity: '0.4' },
          '100%': { transform: 'scaleY(1.0)', opacity: '1.0' },
        }
      }
    },
  },
  plugins: [],
}
