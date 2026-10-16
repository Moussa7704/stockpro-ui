import type { QueryClient } from '@tanstack/react-query'
import { QueryClientProvider } from '@tanstack/react-query'
import { App as AntdApp, ConfigProvider } from 'antd'
import frFR from 'antd/locale/fr_FR'
import type { ReactNode } from 'react'
import { Provider } from 'react-redux'
import type { AppStore } from '../store'

/** Mêmes fournisseurs que main.tsx (store, cache, antd en français), avec un store et un cache propres au test. */
export function Providers({ store, queryClient, children }: { store: AppStore; queryClient: QueryClient; children: ReactNode }) {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider locale={frFR}>
          <AntdApp>{children}</AntdApp>
        </ConfigProvider>
      </QueryClientProvider>
    </Provider>
  )
}
