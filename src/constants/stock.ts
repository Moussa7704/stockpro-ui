import type { AdjustmentReason, InventoryStatus, MovementType, TransferStatus } from '../types/stock'

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  adjustment: 'Ajustement',
  inventory_adjustment: 'Inventaire',
  transfer_out: 'Transfert sortant',
  transfer_in: 'Transfert entrant',
  purchase_receipt: 'Réception fournisseur',
  supplier_return: 'Retour fournisseur',
  sale: 'Vente',
  customer_return: 'Retour client',
  sale_cancellation: 'Vente annulée',
}

export const ADJUSTMENT_REASON_LABELS: Record<AdjustmentReason, string> = {
  opening_balance: 'Stock initial',
  correction: 'Correction',
  loss: 'Perte',
  damage: 'Casse',
  theft: 'Vol',
  expired: 'Périmé',
  gift: 'Don / échantillon',
  other: 'Autre',
}

/** Motifs qui ajoutent du stock par nature (les autres le retirent, sauf correction et autre). */
export const ENTRY_REASONS: AdjustmentReason[] = ['opening_balance']
export const EXIT_REASONS: AdjustmentReason[] = ['loss', 'damage', 'theft', 'expired', 'gift']

export const TRANSFER_STATUS: Record<TransferStatus, { label: string; color: string }> = {
  draft: { label: 'En préparation', color: 'default' },
  shipped: { label: 'En route', color: 'blue' },
  received: { label: 'Reçu', color: 'green' },
  cancelled: { label: 'Annulé', color: 'red' },
}

export const INVENTORY_STATUS: Record<InventoryStatus, { label: string; color: string }> = {
  draft: { label: 'En cours de comptage', color: 'blue' },
  validated: { label: 'Validé', color: 'green' },
  cancelled: { label: 'Annulé', color: 'red' },
}
