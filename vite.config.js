import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/',

  define: {
    'import.meta.env.USE_IMAGE_TEXT': JSON.stringify(process.env.USE_IMAGE_TEXT || 'false')
  },

  optimizeDeps: {
    include: ['yjs', 'y-websocket', '@lexical/yjs', 'prismjs'],
    esbuildOptions: {
      define: {
        global: 'globalThis'
      }
    }
  },

  plugins: [react()],

  server: {
    host: '127.0.0.1',
    port: 5173,
    hmr: {
      clientPort: 5173
    }
  },

  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three') || id.includes('@react-three')) {
              return 'three-vendor';
            }
            if (id.includes('lexical') || id.includes('@lexical')) {
              if (!id.includes('prismjs')) {
                return 'lexical-vendor';
              }
            }
            if (id.includes('yjs') || id.includes('y-websocket')) {
              return 'yjs-vendor';
            }
          }
        }
      }
    }
  }
});
