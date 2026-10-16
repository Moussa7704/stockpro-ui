import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Tests du front : composants rendus dans jsdom, API simulée par MSW (src/test/server.ts)
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Scénarios complets (commande → envoi → réception…) : longs sous la charge de toute la suite
    testTimeout: 30_000,
  },
})
