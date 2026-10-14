import { StyleProvider } from '@ant-design/cssinjs'
import { App as AntdApp, ConfigProvider } from 'antd'
import frFR from 'antd/locale/fr_FR'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* layer : les styles antd vont dans @layer antd (voir index.css) */}
    <StyleProvider layer>
      <ConfigProvider locale={frFR} theme={{ token: { colorPrimary: '#4f46e5', borderRadius: 8 } }}>
        {/* AntdApp : donne accès à message / notification / modal via App.useApp() */}
        <AntdApp>
          <App />
        </AntdApp>
      </ConfigProvider>
    </StyleProvider>
  </StrictMode>,
)
