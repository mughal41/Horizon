import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import JavaScriptObfuscator from 'javascript-obfuscator';

export default defineConfig(() => {
  return {
    base: './',
    build: { sourcemap: false },
    plugins: [react(), tailwindcss(), {
      name: 'production-obfuscation',
      apply: 'build',
      enforce: 'post',
      renderChunk(code) {
        return { code: JavaScriptObfuscator.obfuscate(code, {
          compact: true,
          sourceMap: false,
          target: 'browser',
          seed: 42,
          renameGlobals: false,
          stringArray: true,
          stringArrayEncoding: ['base64'],
          controlFlowFlattening: false,
        }).getObfuscatedCode(), map: null };
      },
    }],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
