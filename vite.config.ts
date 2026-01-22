import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// Custom plugin to convert ES module imports/exports to CommonJS for preload script
function convertToCommonJS(): Plugin {
  return {
    name: 'convert-to-commonjs',
    generateBundle(_, bundle) {
      for (const fileName of Object.keys(bundle)) {
        if (fileName.endsWith('.cjs')) {
          const chunk = bundle[fileName];
          if (chunk.type === 'chunk') {
            // Convert import statements to require()
            chunk.code = chunk.code.replace(
              /^import\s+{([^}]+)}\s+from\s+["']([^"']+)["'];?$/gm,
              (match, imports, module) => {
                const cleaned = imports.split(',').map((s: string) => s.trim());
                const requires = cleaned.map((imp: string) => {
                  const [imported, local] = imp.includes(' as ')
                    ? imp.split(' as ').map((s: string) => s.trim())
                    : [imp, imp];
                  return `const ${local} = require("${module}").${imported};`;
                }).join('\n');
                return requires;
              }
            );

            // Convert export default to module.exports
            chunk.code = chunk.code.replace(
              /^export\s+default\s+(.+);?$/gm,
              'module.exports = $1;'
            );

            // Convert named exports to module.exports
            chunk.code = chunk.code.replace(
              /^export\s+{([^}]+)};?$/gm,
              (match, exports) => {
                const cleaned = exports.split(',').map((s: string) => s.trim());
                return cleaned.map((exp: string) => {
                  const [local, exported] = exp.includes(' as ')
                    ? exp.split(' as ').map((s: string) => s.trim())
                    : [exp, exp];
                  return `module.exports.${exported} = ${local};`;
                }).join('\n');
              }
            );

            // Convert export const/let/var to module.exports
            chunk.code = chunk.code.replace(
              /^export\s+(const|let|var)\s+(\w+)\s*=/gm,
              '$1 $2 =\nmodule.exports.$2 ='
            );

            // Convert export function/class to module.exports
            chunk.code = chunk.code.replace(
              /^export\s+(function|class)\s+(\w+)/gm,
              (match, type, name) => {
                return `${type} ${name}`;
              }
            );
            // Add module.exports assignment after function/class declarations
            chunk.code = chunk.code.replace(
              /^(function|class)\s+(\w+)([^{]*{[\s\S]*?^})/gm,
              (match, type, name, body) => {
                return `${match}\nmodule.exports.${name} = ${name};`;
              }
            );
          }
        }
      }
    },
  };
}

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
                external: [
                  'electron',
                  '@prisma/client',
                  '.prisma/client',
                  'node-pty',
                  'better-sqlite3',
                ],
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
            plugins: [convertToCommonJS()],
            build: {
              sourcemap: isServe ? 'inline' : undefined,
              minify: isBuild,
              outDir: 'dist-electron',
              rollupOptions: {
                external: ['electron'],
                output: {
                  // CRITICAL: Force CommonJS format for Electron's sandboxed preload environment
                  // ES modules (import/export) will cause "Cannot use import statement outside a module" error
                  format: 'cjs',
                  entryFileNames: 'preload.cjs',
                  // Disable code splitting to prevent require() issues with nodeIntegration: false
                  inlineDynamicImports: true,
                },
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
      strictPort: false, // Allow fallback to next available port
      host: 'localhost', // Be explicit about hostname for HMR
    },
    clearScreen: false,
  };
});
