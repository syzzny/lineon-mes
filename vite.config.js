import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build`         → 일반 배포용 빌드 (Vercel 등)
// `npm run build:preview` → 미리보기용 단일 HTML 파일 빌드
export default defineConfig(({ mode }) => ({
  build: { chunkSizeWarningLimit: 900 },
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
}))
