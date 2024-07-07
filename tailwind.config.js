const { nextui } = require('@nextui-org/theme')
import themes from './themes.json'

/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/@nextui-org/theme/dist/components/(badge|button|calendar|card|checkbox|date-input|date-picker|divider|dropdown|input|link|listbox|modal|navbar|popover|progress|select|skeleton|table|ripple|spinner|menu|scroll-shadow|spacer).js',
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
    },
  },
  darkMode: 'class',
  plugins: [nextui(themes)],
}

export default config
