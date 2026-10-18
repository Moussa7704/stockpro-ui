import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom'
import { createQueryClient } from '../lib/queryClient'
import { preloadAllPages } from '../routes/lazyPage'
import { routes } from '../routes/router'
import { makeStore, type RootState } from '../store'
import type { MeResponse } from '../types/auth'
import { meResponse } from './fixtures'
import { Providers } from './Providers'

// Écrans chargés à la demande dans l'application : en test, on les charge tous avant le premier
// test (comme avant le découpage), sinon leur compilation compterait dans les délais d'attente
await preloadAllPages()

interface RenderOptions {
  /** Session ouverte (par défaut : propriétaire de "Commerce 1") ; null = visiteur non connecté */
  session?: MeResponse | null
  shop?: RootState['shop']
}

function setup({ session = meResponse(), shop }: RenderOptions) {
  const queryClient = createQueryClient()
  // En test, une erreur doit apparaître tout de suite, sans nouvelles tentatives
  queryClient.setDefaultOptions({ queries: { ...queryClient.getDefaultOptions().queries, retry: false } })
  const store = makeStore({
    queryClient,
    preloadedState: {
      auth: session ? { status: 'authenticated', session } : { status: 'anonymous', session: null },
      ...(shop && { shop }),
    },
  })
  return { queryClient, store }
}

/** Application complète (vraies routes, gardes compris) ouverte sur `route`. */
export function renderApp(route: string, options: RenderOptions = {}) {
  const { queryClient, store } = setup(options)
  const router = createMemoryRouter(routes, { initialEntries: [route] })
  const user = userEvent.setup()
  render(
    <Providers store={store} queryClient={queryClient}>
      <RouterProvider router={router} />
    </Providers>,
  )
  return { store, router, queryClient, user }
}

/** Un composant seul, avec le store, le cache et un routeur minimal. */
export function renderWithProviders(ui: ReactElement, options: RenderOptions = {}) {
  const { queryClient, store } = setup(options)
  const user = userEvent.setup()
  render(
    <Providers store={store} queryClient={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </Providers>,
  )
  return { store, queryClient, user }
}
