import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: 'client',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client/src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/trpc': { target: 'http://localhost:3000', changeOrigin: true },
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'wouter'],
          'query-vendor': ['@tanstack/react-query', '@trpc/client', '@trpc/react-query'],
          'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'ui-vendor': [
            'class-variance-authority', 'clsx', 'tailwind-merge', 'lucide-react',
            '@radix-ui/react-checkbox', '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu', '@radix-ui/react-label',
            '@radix-ui/react-progress', '@radix-ui/react-select',
            '@radix-ui/react-separator', '@radix-ui/react-slot',
            '@radix-ui/react-tabs', '@radix-ui/react-toast',
          ],
          'motion-vendor': ['framer-motion'],
          'sentry-vendor': ['@sentry/react'],
        },
      },
    },
    chunkSizeWarningLimit: 300,
  },
})
