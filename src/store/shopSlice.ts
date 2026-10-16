import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from './index'

/**
 * Boutique active, mémorisée par entreprise (un gérant de deux entreprises retrouve la bonne
 * boutique dans chacune). Persistée dans le navigateur : on la retrouve au prochain chargement.
 */
interface ShopState {
  byCompany: Record<string, string>
}

export const SHOP_STORAGE_KEY = 'stockpro.activeShops'

/** Lecture prudente : stockage indisponible (navigation privée) ou contenu invalide → rien. */
export function loadShopState(): ShopState {
  try {
    const raw = localStorage.getItem(SHOP_STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const entries = Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      return { byCompany: Object.fromEntries(entries) }
    }
  } catch {
    // stockage illisible : on repart de zéro
  }
  return { byCompany: {} }
}

export function saveShopState(state: ShopState): void {
  try {
    localStorage.setItem(SHOP_STORAGE_KEY, JSON.stringify(state.byCompany))
  } catch {
    // stockage plein ou interdit : la boutique sera simplement redemandée
  }
}

const shopSlice = createSlice({
  name: 'shop',
  initialState: (): ShopState => ({ byCompany: {} }),
  reducers: {
    activeShopChanged(state, action: PayloadAction<{ companyId: string; shopId: string }>) {
      state.byCompany[action.payload.companyId] = action.payload.shopId
    },
  },
})

export const { activeShopChanged } = shopSlice.actions
export const shopReducer = shopSlice.reducer

/** Boutique mémorisée pour l'entreprise active (à valider contre la liste des boutiques accessibles). */
export const selectStoredShopId = (state: RootState) => {
  const companyId = state.auth.session?.activeCompany?.id
  return companyId ? (state.shop.byCompany[companyId] ?? null) : null
}
