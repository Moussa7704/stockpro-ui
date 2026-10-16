import type { Discount } from '../../types/pos'

/**
 * Aperçu du ticket dans le navigateur : MÊMES règles que le serveur (server/src/modules/pos/
 * sale-pricing.ts), pour afficher le total en direct. Le serveur recalcule tout et reste seul juge.
 * Calcul en centimes entiers : aucune erreur d'arrondi des nombres à virgule.
 */

/** "1500.50" → 150050 centimes. */
export const toCents = (value: string | number | null | undefined): number => Math.round(Number(value || 0) * 100)

/** 150050 → "1500.50" (format attendu par l'API). */
export const fromCents = (cents: number): string => (cents / 100).toFixed(2)

/** Arrondi à la devise, demi supérieur : FCFA à l'unité, autres devises au centime. */
export function roundToCurrency(cents: number, currency: string): number {
  if (currency !== 'XOF') return Math.round(cents)
  return Math.round(cents / 100) * 100
}

function discountCents(base: number, discount: Discount | undefined, currency: string): number {
  if (!discount || discount.value === '') return 0
  return discount.type === 'amount' ? toCents(discount.value) : roundToCurrency((base * Number(discount.value)) / 100, currency)
}

export interface PricingInput {
  quantity: string
  unitPrice: string
  discount?: Discount
  name?: string
}

export interface PricedCart {
  lines: { gross: number; discount: number; total: number }[]
  subtotal: number
  discountTotal: number
  total: number
  /** Remise supérieure au montant : le serveur refuserait la vente */
  error: string | null
}

export function priceCart(lines: PricingInput[], cartDiscount: Discount | undefined, currency = 'XOF'): PricedCart {
  let error: string | null = null

  // 1. Prix et remise de chaque ligne
  const draft = lines.map((line) => {
    const gross = roundToCurrency(Number(line.quantity || 0) * toCents(line.unitPrice), currency)
    let lineDiscount = discountCents(gross, line.discount, currency)
    if (lineDiscount > gross) {
      error ??= `« ${line.name ?? 'Ligne'} » : la remise dépasse le montant`
      lineDiscount = gross
    }
    return { gross, lineDiscount, net: gross - lineDiscount }
  })

  // 2. Remise du ticket, répartie au prorata des lignes (la dernière prend le reste)
  const netTotal = draft.reduce((sum, item) => sum + item.net, 0)
  let cart = discountCents(netTotal, cartDiscount, currency)
  if (cart > netTotal) {
    error ??= 'Ticket : la remise dépasse le montant'
    cart = netTotal
  }
  let allocated = 0
  const priced = draft.map((item, index) => {
    const isLast = index === draft.length - 1
    const share = netTotal === 0 ? 0 : isLast ? cart - allocated : roundToCurrency((cart * item.net) / netTotal, currency)
    allocated += share
    const discount = item.lineDiscount + share
    return { gross: item.gross, discount, total: item.gross - discount }
  })

  const subtotal = priced.reduce((sum, line) => sum + line.gross, 0)
  const discountTotal = priced.reduce((sum, line) => sum + line.discount, 0)
  return { lines: priced, subtotal, discountTotal, total: subtotal - discountTotal, error }
}

/** Remise totale en % du sous-total (plafond des caissiers sans la permission « remises »). */
export function discountPercent(cart: PricedCart): number {
  return cart.subtotal === 0 ? 0 : (cart.discountTotal / cart.subtotal) * 100
}

export interface Settlement {
  paid: number
  change: number // monnaie rendue (espèces seulement)
  balanceDue: number // reste dû : vente à crédit, client obligatoire
  error: string | null
}

/**
 * Règlement : ex. total 4 500, client donne 5 000 en espèces → rendu 500.
 * Un trop-perçu n'est possible qu'en espèces (on ne rend pas la monnaie sur un paiement mobile).
 */
export function settle(totalCents: number, payments: { amount: string; isCash: boolean }[]): Settlement {
  const paid = payments.reduce((sum, payment) => sum + toCents(payment.amount), 0)
  const change = Math.max(0, paid - totalCents)
  const cash = payments.filter((payment) => payment.isCash).reduce((sum, payment) => sum + toCents(payment.amount), 0)
  const error = change > cash ? 'Le montant payé dépasse le total : seules les espèces permettent de rendre la monnaie' : null
  return { paid, change, balanceDue: Math.max(0, totalCents - (paid - change)), error }
}
