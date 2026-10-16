import type { ProductRef } from '../../types/stock'

/** Ligne de document d'achat en cours de saisie. */
export interface PricedLine {
  product: ProductRef & { unit?: { symbol: string; allowsDecimal: boolean } }
  quantity: string | null
  unitCost: string | null
  /** Réception d'une commande : ligne de commande correspondante et reste à recevoir */
  orderLineId?: string
  remaining?: string
}

/** Total indicatif d'une ligne (le serveur recalcule et arrondit). */
export const lineTotal = (line: PricedLine) => (line.quantity && line.unitCost ? Math.round(Number(line.quantity) * Number(line.unitCost)) : null)

export function documentTotal(lines: PricedLine[]): number {
  return lines.reduce((sum, line) => sum + (lineTotal(line) ?? 0), 0)
}

/** Vérifie la saisie ; renvoie un message d'erreur en français, ou null si tout est bon. */
export function validateLines(lines: PricedLine[], costRequired = true): string | null {
  if (lines.length === 0) return 'Ajoutez au moins un produit'
  if (lines.some((line) => !line.quantity || Number(line.quantity) <= 0)) return 'Chaque ligne doit avoir une quantité positive'
  if (costRequired && lines.some((line) => line.unitCost === null || line.unitCost === '')) return 'Indiquez le coût unitaire de chaque ligne'
  return null
}
