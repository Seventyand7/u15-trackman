import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 會把網站放在 https://<帳號>.github.io/<repo 名稱>/ 底下，
// 所以 build 時的 base 必須是 "/<repo 名稱>/"。
// GitHub Actions 會自動用 repo 名稱帶入 BASE_PATH，本機開發則維持 "/"。
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [react()],
})
