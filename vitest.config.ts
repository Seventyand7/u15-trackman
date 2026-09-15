import { defineConfig } from 'vitest/config'

// 單元測試只跑純函式（排名、球員合併等），不需要 React 或瀏覽器環境，
// 所以獨立一份設定，不去載 vite.config.ts 的 plugin。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
