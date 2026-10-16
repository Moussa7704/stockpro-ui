import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { setAccessToken, setSessionExpiredHandler } from '../services/api'
import { server } from './server'

// jsdom ne connaît pas matchMedia ni ResizeObserver, utilisés par antd (grilles, tableaux)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Requête non simulée = test en erreur (jamais d'appel réel vers l'API)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
  setAccessToken(null)
  setSessionExpiredHandler(null)
  localStorage.clear()
})
afterAll(() => server.close())
