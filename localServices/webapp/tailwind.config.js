const { nextui } = require('@nextui-org/theme')
import themes from './themes.json'

/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/@nextui-org/theme/dist/components/(badge|button|calendar|card|checkbox|date-input|date-picker|divider|dropdown|input|link|listbox|modal|navbar|popover|progress|select|skeleton|spinner|table|ripple|menu|scroll-shadow|spacer).js',
  ],
  theme: {
    extend: {
      fontFamily: {
        volkorn: ['var(--font-vollkorn)'],
      },
      screens: {
        fhd: '1860px',
        qhd: '2500px',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'pulse-glow': {
          '0%, 100%': {
            opacity: '1',
            boxShadow: '0 0 0 0 rgba(245, 158, 11, 0)',
          },
          '50%': {
            opacity: '0.8',
            boxShadow: '0 0 20px 4px rgba(245, 158, 11, 0.3)',
          },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  darkMode: 'class',
  plugins: [nextui(themes)],
}

export default config
