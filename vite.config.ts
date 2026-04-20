import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Required: Tell Vite to treat leaflet marker PNGs as assets
  assetsInclude: ['**/*.png', '**/*.gif'],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'leaflet': ['leaflet', 'react-leaflet'],
          'dnd-kit': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          'react-vendor': ['react', 'react-dom'],
          'socket': ['socket.io-client'],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  // Required to handle leaflet's CSS url() references
  css: {
    preprocessorOptions: {},
  },
});
