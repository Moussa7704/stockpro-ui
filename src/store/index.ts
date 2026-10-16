import { combineReducers, configureStore, type ThunkAction, type UnknownAction } from '@reduxjs/toolkit'
import type { QueryClient } from '@tanstack/react-query'
import { queryClient as defaultQueryClient } from '../lib/queryClient'
import { authReducer } from './authSlice'
import { loadShopState, saveShopState, shopReducer } from './shopSlice'

/**
 * État de l'application (Redux Toolkit) : session et droits, boutique active, et bientôt le
 * panier de caisse. Les données serveur (listes, fiches) sont dans le cache TanStack Query.
 */
const rootReducer = combineReducers({
  auth: authReducer,
  shop: shopReducer,
})

export type RootState = ReturnType<typeof rootReducer>

/** Dépendances passées aux thunks : vider le cache serveur à la déconnexion ou au changement d'entreprise. */
export interface ThunkExtra {
  queryClient: QueryClient
}

export function makeStore(options: { queryClient?: QueryClient; preloadedState?: Partial<RootState> } = {}) {
  return configureStore({
    reducer: rootReducer,
    preloadedState: options.preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        thunk: { extraArgument: { queryClient: options.queryClient ?? defaultQueryClient } satisfies ThunkExtra },
      }),
  })
}

export type AppStore = ReturnType<typeof makeStore>
export type AppDispatch = AppStore['dispatch']
export type AppThunk<R = void> = ThunkAction<R, RootState, ThunkExtra, UnknownAction>

/** Store de l'application, avec la boutique active relue puis sauvegardée dans le navigateur. */
export function createAppStore(): AppStore {
  const store = makeStore({ preloadedState: { shop: loadShopState() } })
  let previous = store.getState().shop
  store.subscribe(() => {
    const current = store.getState().shop
    if (current !== previous) {
      previous = current
      saveShopState(current)
    }
  })
  return store
}
