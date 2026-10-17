import type { QueryClient } from '@tanstack/react-query'
import { QueryClientProvider } from '@tanstack/react-query'
import { App as AntdApp } from 'antd'
import type { ReactNode } from 'react'
import { Provider } from 'react-redux'
import { BrandTheme } from '../components/BrandTheme'
import type { AppStore } from '../store'

/** Mêmes fournisseurs que main.tsx (store, cache, antd en français aux couleurs de l'entreprise), avec un store et un cache propres au test. */
export function Providers({ store, queryClient, children }: { store: AppStore; queryClient: QueryClient; children: ReactNode }) {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <BrandTheme>
          <AntdApp>{children}</AntdApp>
        </BrandTheme>
      </QueryClientProvider>
    </Provider>
  )
}
