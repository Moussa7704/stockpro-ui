import type { Paginated } from '../types/settings'
import type {
  CreateAdjustmentInput,
  CreateTransferInput,
  InventoryCount,
  ProductStock,
  MovementType,
  StockAdjustment,
  StockAlert,
  StockLevel,
  StockMovement,
  StockTransfer,
  TransferStatus,
} from '../types/stock'
import { api } from './api'

// Stock : lecture avec stock.view ; ajustements et inventaires avec stock.adjust ; transferts avec stock.transfer.
// Le serveur limite toujours les résultats aux boutiques du périmètre de l'utilisateur.

interface Page {
  page: number
  pageSize: number
}

export function listStockLevels(query: Page & { shopId?: string; search?: string; lowStock?: boolean }) {
  return api<Paginated<StockLevel>>('/stock', { params: { ...query, lowStock: query.lowStock || undefined } })
}

export function listStockAlerts(shopId?: string) {
  return api<{ alerts: StockAlert[] }>('/stock/alerts', { params: { shopId } })
}

/** Stock d'un produit dans chaque boutique visible par l'utilisateur. */
export function getProductStock(productId: string) {
  return api<ProductStock>(`/stock/products/${productId}`)
}

export function listMovements(query: Page & { shopId?: string; productId?: string; type?: MovementType }) {
  return api<Paginated<StockMovement>>('/stock/movements', { params: { ...query } })
}

// --- Ajustements
export function listAdjustments(query: Page & { shopId?: string }) {
  return api<Paginated<StockAdjustment>>('/stock/adjustments', { params: { ...query } })
}
export function getAdjustment(id: string) {
  return api<{ adjustment: StockAdjustment }>(`/stock/adjustments/${id}`)
}
export function createAdjustment(input: CreateAdjustmentInput) {
  return api<{ adjustment: StockAdjustment }>('/stock/adjustments', { method: 'POST', body: input })
}

// --- Transferts
export function listTransfers(query: Page & { shopId?: string; status?: TransferStatus }) {
  return api<Paginated<StockTransfer>>('/stock/transfers', { params: { ...query } })
}
export function getTransfer(id: string) {
  return api<{ transfer: StockTransfer }>(`/stock/transfers/${id}`)
}
export function createTransfer(input: CreateTransferInput) {
  return api<{ transfer: StockTransfer }>('/stock/transfers', { method: 'POST', body: input })
}
/** Le stock sort de la boutique de départ. */
export function shipTransfer(id: string) {
  return api<{ transfer: StockTransfer }>(`/stock/transfers/${id}/ship`, { method: 'POST' })
}
/** Sans détail : tout ce qui a été expédié est reçu ; sinon quantités reçues par ligne (écarts tracés). */
export function receiveTransfer(id: string, lines?: { lineId: string; quantityReceived: string }[]) {
  return api<{ transfer: StockTransfer }>(`/stock/transfers/${id}/receive`, { method: 'POST', body: lines ? { lines } : {} })
}
export function cancelTransfer(id: string) {
  return api<{ transfer: StockTransfer }>(`/stock/transfers/${id}/cancel`, { method: 'POST' })
}

// --- Inventaires
export function listInventories(query: Page & { shopId?: string }) {
  return api<Paginated<InventoryCount>>('/stock/inventories', { params: { ...query } })
}
export function getInventory(id: string) {
  return api<{ inventory: InventoryCount }>(`/stock/inventories/${id}`)
}
export function createInventory(input: { shopId: string; notes?: string | null }) {
  return api<{ inventory: InventoryCount }>('/stock/inventories', { method: 'POST', body: input })
}
/** Ajoute ou met à jour des quantités comptées (les lignes non envoyées sont conservées). */
export function setInventoryLines(id: string, lines: { productId: string; countedQuantity: string }[]) {
  return api<{ inventory: InventoryCount }>(`/stock/inventories/${id}/lines`, { method: 'PUT', body: { lines } })
}
/** Fige le stock théorique et corrige les écarts (mouvements « inventaire »). */
export function validateInventory(id: string) {
  return api<{ inventory: InventoryCount }>(`/stock/inventories/${id}/validate`, { method: 'POST' })
}
export function cancelInventory(id: string) {
  return api<{ inventory: InventoryCount }>(`/stock/inventories/${id}/cancel`, { method: 'POST' })
}
