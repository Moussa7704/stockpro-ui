import { StyleProvider } from '@ant-design/cssinjs'
import { QueryClientProvider } from '@tanstack/react-query'
import { App as AntdApp } from 'antd'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import './index.css'
import App from './App.tsx'
import { BrandTheme } from './components/BrandTheme'
import { queryClient } from './lib/queryClient'
import { setSessionExpiredHandler } from './services/api'
import { createAppStore } from './store'
import { restoreSession, sessionExpired } from './store/authSlice'

// Calendriers en français (noms des mois et des jours)
dayjs.locale('fr')

const store = createAppStore()
// Refresh refusé pendant l'utilisation (session révoquée ou expirée) : retour à la connexion
setSessionExpiredHandler(() => store.dispatch(sessionExpired()))
// Une seule fois au démarrage (hors de React : StrictMode exécute les effets deux fois)
void store.dispatch(restoreSession())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        {/* layer : les styles antd vont dans @layer antd (voir index.css) */}
        <StyleProvider layer>
          {/* Couleurs de l'entreprise active (StockPro par défaut) */}
          <BrandTheme>
            {/* AntdApp : donne accès à message / notification / modal via App.useApp() */}
            <AntdApp>
              <App />
            </AntdApp>
          </BrandTheme>
        </StyleProvider>
      </QueryClientProvider>
    </Provider>
  </StrictMode>,
)
