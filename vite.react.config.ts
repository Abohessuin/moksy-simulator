import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const configDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: path.resolve(configDirectory, 'src/react/index.tsx'),
      formats: ['es'],
      fileName: () => 'index.js'
    },
    outDir: path.resolve(configDirectory, 'dist/react'),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      external: ['react', 'react/jsx-runtime'],
      output: { banner: "'use client';" }
    }
  }
});
