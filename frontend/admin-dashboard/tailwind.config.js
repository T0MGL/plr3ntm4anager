/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: '#F6F2EC',
          50: '#FDFBF8',
          100: '#F6F2EC',
          200: '#EDE5D8',
          300: '#E0D4C0',
        },
        charcoal: {
          DEFAULT: '#1A1A1A',
          50: '#F5F5F5',
          100: '#E8E8E8',
          200: '#C8C8C8',
          300: '#A0A0A0',
          400: '#6B6B6B',
          500: '#4A4A4A',
          600: '#333333',
          700: '#242424',
          800: '#1A1A1A',
          900: '#0D0D0D',
        },
        gold: {
          DEFAULT: '#C4A96B',
          light: '#D4BE91',
          dark: '#A88B4D',
          muted: '#C4A96B33',
        },
        stone: {
          DEFAULT: '#E2DDD4',
          light: '#EDEAE4',
          dark: '#C8C2B6',
        },
        ink: '#1A1A1A',
        clay: '#F6F2EC',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        '8xl': '88rem',
      },
    },
  },
  plugins: [],
};
