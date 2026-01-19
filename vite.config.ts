import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const isServe = command === 'serve';
  const isBuild = command === 'build';

  return {
    plugins: [
      tailwindcss(),
      react(),
      electron([
        {
          // Main process entry file
          entry: 'electron/main.ts',
          onstart({ startup }) {
            if (isServe) {
              startup();
            }
          },
          vite: {
            build: {
              sourcemap: isServe,
              minify: isBuild,
              outDir: 'dist-electron',
              rollupOptions: {
                external: ['electron'],
              },
            },
          },
        },
        {
          // Preload script entry file
          entry: 'electron/preload.ts',
          onstart({ reload }) {
            if (isServe) {
              reload();
            }
          },
          vite: {
            build: {
              sourcemap: isServe ? 'inline' : undefined,
              minify: isBuild,
              outDir: 'dist-electron',
              rollupOptions: {
                external: ['electron'],
              },
            },
          },
        },
      ]),
      // Use Node.js API in the Renderer process
      renderer(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: isServe,
      minify: isBuild ? 'esbuild' : false,
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
        },
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      host: true,
    },
    clearScreen: false,
  };
});
