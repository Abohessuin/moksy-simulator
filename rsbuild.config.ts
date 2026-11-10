import { defineConfig } from '@rsbuild/core';
import { pluginDts } from 'rsbuild-plugin-dts';

export default defineConfig({
  plugins: [
    pluginDts(),
  ],
  source: {
    entry: {
      index: './src/index.ts',
      cli: './src/cli.ts',
    },
  },
  output: {
    target: 'node',
    distPath: {
      root: 'dist',
      js: '',
    },
    filenameHash: false,
    cleanDistPath: true,
    autoExternal: true,
  },
  tools: {
    rspack(config) {
      config.optimization = config.optimization || {};
      config.optimization.runtimeChunk = false;
      config.optimization.splitChunks = false;
    },
  },
});
