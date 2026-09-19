import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sitemapPlugin } from './vite-sitemap.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const contentDir = path.resolve(here, '../content')

export default defineConfig({
  plugins: [react(), sitemapPlugin({ contentDir })],
  resolve: {
    alias: {
      '@': path.resolve(here, 'src'),
      '@content': contentDir,
    },
  },
  // Discover heavy lazy editor dependencies at startup, avoiding a dev-page reload on first use.
  optimizeDeps: {
    include: ['three', 'three/addons/controls/OrbitControls.js', 'three/addons/geometries/RoundedBoxGeometry.js', 'blockly', 'blockly/blocks', '@monaco-editor/react', 'monaco-editor/esm/vs/editor/editor.api', 'monaco-editor/esm/vs/editor/editor.all', 'monaco-editor/esm/vs/basic-languages/python/python.contribution'],
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
          // Keep Vite's shared import helper out of Monaco, or the entry chunk eagerly imports it.
          if (id.includes('vite/preload-helper') || id.includes('commonjsHelpers')) return 'vendor'
          if (id.includes('node_modules/monaco-editor') || id.includes('node_modules/@monaco-editor')) return 'monaco'
          if (id.includes('node_modules/blockly')) return 'blockly'
          if (id.includes('node_modules/three/')) return 'three'
          if (id.includes('/src/engine/hpc/')) return 'hpc-model'
          if (id.includes('/src/engine/matlab/')) return 'matlab-model'
          if (id.includes('/src/engine/agents/')) return 'agents-model'
          if (id.includes('/src/engine/computer/')) return 'computer-model'
          if (id.includes('/src/engine/cybersecurity/')) return 'cybersecurity-model'
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
    include: ['src/**/*.test.{js,jsx}', '*.test.js'],
    globals: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
    pool: 'threads',
  },
})
