import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Libraries that change far less often than the app: in a chunk of their own,
// so a new deploy of the app leaves them cached in the browser.
const VENDOR = /[\\/]node_modules[\\/](react|react-dom|scheduler|clipper-lib)[\\/]/;

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => (VENDOR.test(id) ? 'vendor' : undefined),
      },
    },
  },
});
