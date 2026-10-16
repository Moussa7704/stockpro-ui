import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit'
import type { Discount } from '../types/pos'
import { sessionCleared } from './authSlice'
import type { RootState } from './index'

/**
 * Panier de la caisse. Sauvegardé dans le navigateur avec la clé d'idempotence de la vente en
 * cours : après un rechargement ou une coupure, la même vente est renvoyée avec la même clé et
 * le serveur ne l'enregistre jamais deux fois. Une nouvelle clé n'est créée qu'après une vente réussie.
 */

export interface CartLine {
  productId: string
  sku: string
  name: string
  unitSymbol: string
  allowsDecimal: boolean
  catalogPrice: string
  unitPrice: string // différent du prix catalogue : permission « modifier le prix »
  quantity: string
  discount?: Discount
}

export interface PosState {
  /** Panier lié à une entreprise et une boutique : changer de boutique repart d'un panier vide */
  companyId: string | null
  shopId: string | null
  lines: CartLine[]
  discount?: Discount
  customer: { id: string; name: string } | null
  notes: string
  idempotencyKey: string
}

const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : nanoid())

export const emptyCart = (companyId: string | null = null, shopId: string | null = null): PosState => ({
  companyId,
  shopId,
  lines: [],
  customer: null,
  notes: '',
  idempotencyKey: newKey(),
})

export const POS_STORAGE_KEY = 'stockpro.posCart'

export function loadPosState(): PosState {
  try {
    const raw = localStorage.getItem(POS_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<PosState>) : null
    if (parsed && Array.isArray(parsed.lines) && typeof parsed.idempotencyKey === 'string') {
      return { ...emptyCart(), ...parsed } as PosState
    }
  } catch {
    // panier illisible : on repart d'un panier vide
  }
  return emptyCart()
}

export function savePosState(state: PosState): void {
  try {
    localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // stockage indisponible : le panier ne survivra pas à un rechargement, la vente reste possible
  }
}

const findLine = (state: PosState, productId: string) => state.lines.find((line) => line.productId === productId)

const posSlice = createSlice({
  name: 'pos',
  initialState: () => emptyCart(),
  reducers: {
    /** Caisse ouverte sur une autre entreprise ou boutique : le panier précédent n'a rien à faire ici. */
    cartBound(state, action: PayloadAction<{ companyId: string; shopId: string }>) {
      if (state.companyId !== action.payload.companyId || state.shopId !== action.payload.shopId) {
        return emptyCart(action.payload.companyId, action.payload.shopId)
      }
      return state
    },
    /** Scan ou choix d'un produit : nouvelle ligne, ou +1 si le produit est déjà dans le panier. */
    productAdded(state, action: PayloadAction<Omit<CartLine, 'quantity' | 'unitPrice'> & { quantity?: string }>) {
      const existing = findLine(state, action.payload.productId)
      if (existing) {
        existing.quantity = String(Number(existing.quantity) + Number(action.payload.quantity ?? 1))
        return
      }
      state.lines.push({ ...action.payload, unitPrice: action.payload.catalogPrice, quantity: action.payload.quantity ?? '1' })
    },
    quantityChanged(state, action: PayloadAction<{ productId: string; quantity: string }>) {
      const line = findLine(state, action.payload.productId)
      if (line) line.quantity = action.payload.quantity
    },
    unitPriceChanged(state, action: PayloadAction<{ productId: string; unitPrice: string }>) {
      const line = findLine(state, action.payload.productId)
      if (line) line.unitPrice = action.payload.unitPrice
    },
    lineDiscountChanged(state, action: PayloadAction<{ productId: string; discount?: Discount }>) {
      const line = findLine(state, action.payload.productId)
      if (line) line.discount = action.payload.discount
    },
    lineRemoved(state, action: PayloadAction<string>) {
      state.lines = state.lines.filter((line) => line.productId !== action.payload)
    },
    cartDiscountChanged(state, action: PayloadAction<Discount | undefined>) {
      state.discount = action.payload
    },
    customerChanged(state, action: PayloadAction<{ id: string; name: string } | null>) {
      state.customer = action.payload
    },
    notesChanged(state, action: PayloadAction<string>) {
      state.notes = action.payload
    },
    /** Après une vente réussie (ou abandon du panier) : panier vide et NOUVELLE clé d'idempotence. */
    cartCleared(state) {
      return emptyCart(state.companyId, state.shopId)
    },
  },
  extraReducers: (builder) => {
    // Déconnexion ou session expirée : le caissier suivant ne retrouve jamais le panier du précédent
    builder.addCase(sessionCleared, () => emptyCart())
  },
})

export const {
  cartBound,
  productAdded,
  quantityChanged,
  unitPriceChanged,
  lineDiscountChanged,
  lineRemoved,
  cartDiscountChanged,
  customerChanged,
  notesChanged,
  cartCleared,
} = posSlice.actions
export const posReducer = posSlice.reducer

export const selectCart = (state: RootState) => state.pos
