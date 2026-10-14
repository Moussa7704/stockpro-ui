import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // En dev, /api/* est transmis à l'API Express : même origine pour le navigateur,
      // donc pas de CORS et le cookie refreshToken (sameSite strict) fonctionne
      '/api': 'http://localhost:3000',
    },
  },
})
