import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        // Chaque écran est déjà un fichier à part (routes/lazyPage.ts), et le découpage automatique
        // garde les graphiques et les composants lourds d'antd (tableau, calendrier…) avec les écrans
        // qui s'en servent. On isole seulement React, qui ne change presque jamais : le navigateur le
        // garde en cache d'une version de l'application à l'autre.
        //
        // Ne PAS désactiver includeDependenciesRecursively ni regrouper des bibliothèques partagées :
        // l'ordre d'exécution entre fichiers devient invalide (« O is not a function » sur les graphiques).
        // Après tout changement ici : construire puis charger chaque fichier dans un navigateur.
        codeSplitting: {
          groups: [
            {
              name: 'vendor-react',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 20,
            },
          ],
        },
      },
    },
  },
  server: {
    proxy: {
      // En dev, /api/* est transmis à l'API Express : même origine pour le navigateur,
      // donc pas de CORS et le cookie refreshToken (sameSite strict) fonctionne
      '/api': 'http://localhost:3000',
    },
  },
})
