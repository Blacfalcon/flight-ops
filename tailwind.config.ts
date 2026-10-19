import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#0B1F3A', 2: '#13305A', 3: '#1A3F75', line: '#1E3A63', muted: '#9FB3D1', text: '#DCE6F5' },
        ground: '#F3F6FA',
        line: '#DCE3EC',
        ink: { DEFAULT: '#0F1B2D', muted: '#4A5A70' },
        brand: { DEFAULT: '#1F5FD1', dark: '#163F8C', soft: '#E6EEFB', text: '#1F4FB0' },
        good: { bg: '#E5F4EC', fg: '#0F6B3A', solid: '#16884A' },
        warn: { bg: '#FDF1DE', fg: '#8A4B05', solid: '#C77700', edge: '#F2A93B' },
        bad: { bg: '#FBE7E6', fg: '#A1231B', solid: '#B42318' },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
