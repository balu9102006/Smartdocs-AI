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
        /* Ledger palette — ink ground, paper surfaces, brass hardware */
        ink: {
          DEFAULT: '#14151b',   // page ground
          deep: '#0e0f14',      // navbar / deepest ink
          soft: '#1c1d25',      // raised surface on ink
          line: '#2a2b35',      // hairline borders on ink
          text: '#211f1a',      // body text printed on paper
        },
        paper: {
          DEFAULT: '#ddd7c4',   // card / sheet
          raised: '#e5e0d0',    // lifted sheet
          sunk: '#d2ccb8',      // inset well on paper
        },
        parchment: {
          DEFAULT: '#e9e4d3',   // text on ink
          dim: '#b7ae94',       // muted text on ink
        },
        brass: {
          DEFAULT: '#ab7d34',   // primary accent, hardware
          light: '#c89a4b',
          dim: '#8a6428',
        },
        sage: {
          DEFAULT: '#56695a',   // status, secondary
          light: '#6d8271',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'Times New Roman', 'serif'],
        body: ['"Source Serif 4"', 'Georgia', 'Times New Roman', 'serif'],
        sans: ['"Source Serif 4"', 'Georgia', 'Times New Roman', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        sheet: '0 1px 0 rgba(233,228,211,0.04), 0 12px 28px rgba(0,0,0,0.45)',
        leaf: '0 2px 10px rgba(0,0,0,0.35)',
      },
    },
  },
  plugins: [],
}
