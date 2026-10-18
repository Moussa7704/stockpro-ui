import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        // Chaque écran est déjà un fichier à part (routes/lazyPage.ts). On regroupe en plus les
        // bibliothèques qui changent rarement, sous des noms stables : le navigateur les garde en
        // cache d'une version de l'application à l'autre. antd reste découpé par composant
        // (tableau, calendrier… ne viennent qu'avec les écrans qui s'en servent).
        codeSplitting: {
          // Un groupe ne prend QUE les modules qu'il désigne : sinon il avale aussi leurs
          // dépendances partagées (utilitaires communs avec antd) et devient nécessaire partout
          includeDependenciesRecursively: false,
          groups: [
            {
              name: 'vendor-react',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 20,
            },
            // Graphiques : seulement pour le tableau de bord et les rapports. Uniquement les modules
            // propres aux graphiques : un utilitaire partagé ici ferait charger tout le groupe au départ
            {
              name: 'vendor-charts',
              test: /[\\/]node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor)[\\/]/,
              priority: 10,
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
