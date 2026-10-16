import { combineReducers, configureStore, type ThunkAction, type UnknownAction } from '@reduxjs/toolkit'
import type { QueryClient } from '@tanstack/react-query'
import { queryClient as defaultQueryClient } from '../lib/queryClient'
import { authReducer } from './authSlice'
import { loadPosState, posReducer, savePosState } from './posSlice'
import { loadShopState, saveShopState, shopReducer } from './shopSlice'

/**
 * État de l'application (Redux Toolkit) : session et droits, boutique active, panier de caisse.
 * Les données serveur (listes, fiches) sont dans le cache TanStack Query.
 */
const rootReducer = combineReducers({
  auth: authReducer,
  shop: shopReducer,
  pos: posReducer,
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

/** Sauvegarde une partie de l'état dans le navigateur dès qu'elle change. */
function persist<T>(store: AppStore, select: (state: RootState) => T, save: (value: T) => void) {
  let previous = select(store.getState())
  store.subscribe(() => {
    const current = select(store.getState())
    if (current !== previous) {
      previous = current
      save(current)
    }
  })
}

/** Store de l'application : boutique active et panier de caisse relus puis sauvegardés dans le navigateur. */
export function createAppStore(): AppStore {
  const store = makeStore({ preloadedState: { shop: loadShopState(), pos: loadPosState() } })
  persist(store, (state) => state.shop, saveShopState)
  persist(store, (state) => state.pos, savePosState)
  return store
}
