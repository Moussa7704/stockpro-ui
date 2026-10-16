import { StyleProvider } from '@ant-design/cssinjs'
import { QueryClientProvider } from '@tanstack/react-query'
import { App as AntdApp, ConfigProvider } from 'antd'
import frFR from 'antd/locale/fr_FR'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import './index.css'
import App from './App.tsx'
import { queryClient } from './lib/queryClient'
import { setSessionExpiredHandler } from './services/api'
import { createAppStore } from './store'
import { restoreSession, sessionExpired } from './store/authSlice'

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
          <ConfigProvider locale={frFR} theme={{ token: { colorPrimary: '#4f46e5', borderRadius: 8 } }}>
            {/* AntdApp : donne accès à message / notification / modal via App.useApp() */}
            <AntdApp>
              <App />
            </AntdApp>
          </ConfigProvider>
        </StyleProvider>
      </QueryClientProvider>
    </Provider>
  </StrictMode>,
)
