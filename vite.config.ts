import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const src = decodeURIComponent(new URL('./src', import.meta.url).pathname);

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': src } },
  // Chuyển /api sang server Node + MongoDB (npm run server)
  server: { proxy: { '/api': { target: `http://127.0.0.1:${process.env.API_PORT ?? 4000}`, changeOrigin: false } } },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'server/**/*.test.ts'] },
} as never);
