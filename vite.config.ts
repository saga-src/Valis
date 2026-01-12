import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: './', 
      plugins: [
        react(),
        electron({
          main: {
            // 1️⃣ Fix: Build BOTH main.js and ProxyServer.js
            entry: {
              main: 'electron/main.js',
              ProxyServer: 'electron/services/ProxyServer.js', 
            },
            vite: {
                build: {
                    outDir: 'dist-electron/main', 
                    rollupOptions: {
                        external: ['better-sqlite3']
                    }
                }
            }
          },
          preload: {
            input: 'electron/preload.js', 
            vite: {
                build: {
                    outDir: 'dist-electron/preload',
                    rollupOptions: {
                        output: {
                            // 2️⃣ Fix: Force it to be 'index.js' (CJS) so main.js can find it
                            entryFileNames: 'index.js',
                            format: 'cjs'
                        }
                    }
                }
            }
          },
        }),
      ],
      // ... keep your existing server/define/resolve config below ...
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'http://localhost:3001',
            changeOrigin: true,
            secure: false,
          }
        }
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
          '@app': path.resolve(__dirname, './src/app'),
          '@lib': path.resolve(__dirname, './src/lib'),
          '@features': path.resolve(__dirname, './src/features'),
          '@shared': path.resolve(__dirname, './src/shared'),
          '@assets': path.resolve(__dirname, './src/assets')
        }
      },
      build: {
        outDir: 'dist',
        emptyOutDir: true,
      }
    };
});