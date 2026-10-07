import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

export default defineConfig(({ mode }) => {
  const isElectron = process.env.ELECTRON === 'true';

  return {
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8082',
          changeOrigin: true,
        },
      },
    },
    plugins: [
      react(),
      ...(isElectron
        ? [
            electron([
              {
                entry: 'src/main/electron.ts',
                vite: {
                  build: {
                    outDir: 'dist/main',
                  },
                },
              },
              {
                entry: 'src/main/preload.ts',
                onstart(options) {
                  options.reload();
                },
                vite: {
                  build: {
                    outDir: 'dist/main',
                  },
                },
              },
            ]),
            renderer(),
          ]
        : []),
    ],
    test: {
      globals: true,
      environment: 'jsdom',
    },
  };
});
