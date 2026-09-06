import { builtinModules } from 'node:module'
import { defineConfig } from 'vite'

// Builds the Electron main + preload entries into out/.
// Renderer keeps using the root vite.config.ts and dist/.
export default defineConfig({
  build: {
    outDir: 'out',
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: {
        main: 'electron/main.ts',
        preload: 'electron/preload.ts',
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['electron', ...builtinModules, ...builtinModules.map((m) => `node:${m}`)],
    },
  },
})
