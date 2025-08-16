import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia'],
      dts: true
    }),
    Components({
      dts: true
    })
  ],
  server: {
    port: 5013,
    open: true,
    proxy: {
      // 将所有 /api 请求代理到后端8088端口
      '/api': {
        target: 'http://localhost:8088',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      }
    }
  }
})