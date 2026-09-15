/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 操作介面：計分板／球場夜間
        night: {
          950: '#070B16',
          900: '#0B1020',
          850: '#0F152A',
          800: '#141B33',
          700: '#1D2647',
          600: '#2B3760',
          500: '#3D4C7A',
        },
        // 強調色：計分板燈泡的琥珀黃
        amber1: '#FFB020',
        // 圖卡專用（輸出用白底版型的色票，與 UI 主題無關）
        card: {
          header: '#2B3450',
          accent: '#C0392B',
          rule: '#E2E4EA',
          label: '#8A8F9C',
          text: '#33363D',
          zebra: '#F4F5F8',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans TC"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      keyframes: {
        'pop-in': {
          '0%': { transform: 'scale(.94)', opacity: '0' },
          '60%': { transform: 'scale(1.02)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'record-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255,176,32,.0)' },
          '50%': { boxShadow: '0 0 0 4px rgba(255,176,32,.35)' },
        },
      },
      animation: {
        'pop-in': 'pop-in .18s ease-out',
        'record-glow': 'record-glow 1.2s ease-in-out 2',
      },
    },
  },
  plugins: [],
}
