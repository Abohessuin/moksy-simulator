import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const configDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(configDirectory, 'src/modules/dashboard/ui'),
  base: '/_moksy/',
  plugins: [react()],
  server: {
    proxy: { '/_moksy/api': 'http://127.0.0.1:4500' }
  },
  build: {
    outDir: path.resolve(configDirectory, 'dist/dashboard'),
    emptyOutDir: false,
    sourcemap: true
  }
});
