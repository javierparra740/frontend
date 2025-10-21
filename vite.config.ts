import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // 1.  excluir los archivos que rompen el bundle (NO gdal-async)
    exclude: ['mock-aws-s3', 'aws-sdk', 'nock', '@mapbox/node-pre-gyp'],
  },
  build: {
    // 2.  tampoco empaquetes esos módulos de test
    rollupOptions: {
      external: ['mock-aws-s3', 'aws-sdk', 'nock'],
    },
  },
});
