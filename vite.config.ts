import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const src = decodeURIComponent(new URL('./src', import.meta.url).pathname);

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': src } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
} as never);
