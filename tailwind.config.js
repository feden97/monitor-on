/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        terminal: {
          bg: 'rgb(var(--bg-base) / <alpha-value>)',
          panel: 'rgb(var(--bg-panel) / <alpha-value>)',
          surface: 'rgb(var(--bg-surface) / <alpha-value>)',
          border: 'rgb(var(--border-subtle) / <alpha-value>)',
          text: 'rgb(var(--text-primary) / <alpha-value>)',
          muted: 'rgb(var(--text-muted) / <alpha-value>)',
          accent: 'rgb(var(--color-accent) / <alpha-value>)',
        },
        up: {
          DEFAULT: 'rgb(var(--color-up) / <alpha-value>)',
          light: 'rgb(var(--bg-up-light) / <alpha-value>)',
        },
        down: {
          DEFAULT: 'rgb(var(--color-down) / <alpha-value>)',
          light: 'rgb(var(--bg-down-light) / <alpha-value>)',
        },
        flat: {
          DEFAULT: 'rgb(var(--color-flat) / <alpha-value>)',
          light: 'rgb(var(--bg-flat-light) / <alpha-value>)',
        },
        highlight: 'rgb(var(--color-highlight) / <alpha-value>)',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.10)',
      },
    },
  },
  plugins: [],
}
