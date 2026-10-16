// Stock : niveaux, mouvements, ajustements, transferts, inventaires (quantités en chaînes décimales)

export interface ProductRef {
  id: string
  sku: string
  name: string
}

// GET /api/stock : niveau d'un produit dans une boutique
export interface StockLevel {
  shop: { id: string; code: string; name: string }
  product: ProductRef & { barcode: string | null; unit: string }
  quantity: string
  alertThreshold: string
  lowStock: boolean
  // Présents seulement pour ceux qui voient les coûts (reports.view ou stock.adjust)
  averageCost?: string
  stockValue?: string
}

// GET /api/stock/alerts : ruptures en tête, puis stock au niveau ou sous le seuil
export type StockAlertStatus = 'out_of_stock' | 'low_stock'

export interface StockAlert {
  shop: { id: string; code: string; name: string }
  product: ProductRef & { unit: string }
  quantity: string
  alertThreshold: string // 0 : produit sans seuil, signalé seulement en rupture
  status: StockAlertStatus
}

export const MOVEMENT_TYPES = [
  'adjustment',
  'inventory_adjustment',
  'transfer_out',
  'transfer_in',
  'purchase_receipt',
  'supplier_return',
  'sale',
  'customer_return',
  'sale_cancellation',
] as const
export type MovementType = (typeof MOVEMENT_TYPES)[number]

// GET /api/stock/movements : journal en ajout seul
export interface StockMovement {
  id: string
  shopId: string
  productId: string
  type: MovementType
  quantity: string // signée : + entrée, − sortie
  unitCost?: string // coût figé au moment du mouvement (si autorisé)
  balanceAfter: string
  sourceType: string
  sourceId: string
  createdAt: string
  product: ProductRef
}

export const ADJUSTMENT_REASONS = ['opening_balance', 'correction', 'loss', 'damage', 'theft', 'expired', 'gift', 'other'] as const
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number]

export interface StockAdjustment {
  id: string
  shopId: string
  number: string // ex. BTQ1-AJ-2026-000001
  reason: AdjustmentReason
  notes: string | null
  createdBy: string
  createdAt: string
  lines?: { product: ProductRef; quantity: string; balanceAfter: string }[]
}

export interface CreateAdjustmentInput {
  shopId: string
  reason: AdjustmentReason
  notes?: string | null
  // Quantité signée ; coût unitaire facultatif pour une entrée (met à jour le coût moyen)
  lines: { productId: string; quantity: string; unitCost?: string }[]
}

export type TransferStatus = 'draft' | 'shipped' | 'received' | 'cancelled'

export interface StockTransferLine {
  id: string
  productId: string
  quantitySent: string
  quantityReceived: string | null
  unitCost?: string | null
  product: ProductRef
}

export interface StockTransfer {
  id: string
  number: string
  fromShopId: string
  toShopId: string
  status: TransferStatus
  notes: string | null
  createdBy: string
  shippedAt: string | null
  receivedAt: string | null
  createdAt: string
  lines?: StockTransferLine[]
}

export interface CreateTransferInput {
  fromShopId: string
  toShopId: string
  notes?: string | null
  lines: { productId: string; quantity: string }[]
}

export type InventoryStatus = 'draft' | 'validated' | 'cancelled'

export interface InventoryLine {
  id: string
  productId: string
  countedQuantity: string
  // Stock théorique, figé à la validation (null tant que l'inventaire est un brouillon)
  expectedQuantity: string | null
  product: ProductRef
}

export interface InventoryCount {
  id: string
  shopId: string
  number: string
  status: InventoryStatus
  notes: string | null
  createdBy: string
  validatedAt: string | null
  createdAt: string
  lines?: InventoryLine[]
}
