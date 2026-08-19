import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:9999', // เป้าหมายตอนรัน `netlify dev` (functions server)
        changeOrigin: true,
      },
    },
  },
});
