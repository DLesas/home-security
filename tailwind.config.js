const { nextui } = require('@nextui-org/theme')
import themes from './themes.json'

/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@nextui-org/theme/dist/components/(button|calendar|checkbox|date-input|date-picker|divider|input|link|listbox|navbar|popover|progress|skeleton|ripple|spinner).js"
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
