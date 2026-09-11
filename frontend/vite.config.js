import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const contentDir = path.resolve(here, '../content')

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(here, 'src'),
      '@content': contentDir,
    },
  },
  server: {
    port: 5173,
    fs: { allow: [here, contentDir] },
    proxy: {
      '/api': { target: process.env.VITE_PROXY_TARGET || 'http://localhost:8000', changeOrigin: true },
    },
  },
  worker: { format: 'es' },
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/monaco-editor') || id.includes('node_modules/@monaco-editor')) return 'monaco'
          if (id.includes('node_modules/blockly')) return 'blockly'
          if (id.includes('/src/engine/')) return 'engine'
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler') || id.includes('node_modules/zustand') || id.includes('node_modules/react-router')) return 'vendor'
          return undefined
        },
      },
    },
  },
  test: {
    // Engine/store tests run in node; component tests opt into jsdom with a
    // `// @vitest-environment jsdom` docblock on their first line.
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
    globals: false,
  },
})
