import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // @ 路径别名指向 src 目录
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // 允许外部访问
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      // 将 /api 请求代理到后端服务
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // 关闭自动清空 outDir：由 prebuild 脚本统一预创建/清理输出目录，
    // 以兼容部分虚拟化文件系统中异步 mkdir 失败的问题（见 scripts/prebuild.cjs）
    emptyOutDir: false,
    // 提升 chunk size 警告阈值，避免 Ant Design Pro 等依赖包导致构建警告
    chunkSizeWarningLimit: 2000,
  },
});
