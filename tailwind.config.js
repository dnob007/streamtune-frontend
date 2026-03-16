/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:       '#08080e',
        bg2:      '#0f0f18',
        bg3:      '#16161f',
        bg4:      '#1c1c28',
        accent:   '#7c5cfc',
        accent2:  '#c45cfc',
        accent3:  '#5cf8c8',
        live:     '#ff3d5a',
        online:   '#1ecc7a',
        warn:     '#ffb347',
        txt:      '#ede9ff',
        txt2:     '#9b96bb',
        txt3:     '#514d6a',
      },
      fontFamily: {
        sans:    ['DM Sans', 'sans-serif'],
        display: ['Syne', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
