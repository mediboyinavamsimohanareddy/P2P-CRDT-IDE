// Tailwind CSS configuration for DecentraIDE
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          darkest: '#0B0D10',
          dark: '#12151A',
          panel: '#161A21',
          hover: '#1E232B',
        },
        border: {
          subtle: '#232830',
          accent: '#2EE6A6',
        },
        accent: {
          mint: '#2EE6A6',
          mintHover: '#25C890',
        },
        peer: {
          arjun: '#FF6B6B',
          rahul: '#4D96FF',
          mohammed: '#6BCB77',
        },
        status: {
          pass: '#2EE6A6',
          warn: '#FFB200',
          error: '#FF4D4D',
          info: '#4D96FF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
