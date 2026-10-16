import type {
  GoodsReceipt,
  InvoiceInput,
  InvoiceStatus,
  OrderInput,
  OrderStatus,
  PaymentInput,
  PurchaseOrder,
  ReceiptInput,
  ReceiptStatus,
  ReturnInput,
  SupplierBalance,
  SupplierInvoice,
  SupplierReturn,
} from '../types/purchases'
import type { Paginated } from '../types/settings'
import { api } from './api'

// Achats : commandes, réceptions et retours avec purchases.manage ; factures et paiements avec
// supplier_payments.manage. Les opérations qui touchent au stock ou à l'argent sont idempotentes.

interface Page {
  page: number
  pageSize: number
}

// --- Bons de commande
export function listOrders(query: Page & { status?: OrderStatus; supplierId?: string; shopId?: string }) {
  return api<Paginated<PurchaseOrder>>('/purchases/orders', { params: { ...query } })
}
export function getOrder(id: string) {
  return api<{ order: PurchaseOrder }>(`/purchases/orders/${id}`)
}
export function createOrder(input: OrderInput) {
  return api<{ order: PurchaseOrder }>('/purchases/orders', { method: 'POST', body: input })
}
/** Brouillon seulement : date prévue, commentaire, lignes. */
export function updateOrder(id: string, input: Partial<Pick<OrderInput, 'expectedAt' | 'notes' | 'lines'>>) {
  return api<{ order: PurchaseOrder }>(`/purchases/orders/${id}`, { method: 'PATCH', body: input })
}
export function sendOrder(id: string) {
  return api<{ order: PurchaseOrder }>(`/purchases/orders/${id}/send`, { method: 'POST' })
}
export function cancelOrder(id: string) {
  return api<{ order: PurchaseOrder }>(`/purchases/orders/${id}/cancel`, { method: 'POST' })
}
/** Commande partiellement reçue dont on n'attend plus le reste. */
export function closeOrder(id: string) {
  return api<{ order: PurchaseOrder }>(`/purchases/orders/${id}/close`, { method: 'POST' })
}

// --- Réceptions
export function listReceipts(query: Page & { status?: ReceiptStatus; supplierId?: string; shopId?: string; orderId?: string }) {
  return api<Paginated<GoodsReceipt>>('/purchases/receipts', { params: { ...query } })
}
export function getReceipt(id: string) {
  return api<{ receipt: GoodsReceipt }>(`/purchases/receipts/${id}`)
}
export function createReceipt(input: ReceiptInput) {
  return api<{ receipt: GoodsReceipt }>('/purchases/receipts', { method: 'POST', body: input })
}
/** Le stock entre et le coût moyen est recalculé ; rejouable sans double entrée (clé d'idempotence). */
export function validateReceipt(id: string, idempotencyKey: string) {
  return api<{ receipt: GoodsReceipt }>(`/purchases/receipts/${id}/validate`, { method: 'POST', idempotencyKey })
}
export function cancelReceipt(id: string) {
  return api<{ receipt: GoodsReceipt }>(`/purchases/receipts/${id}/cancel`, { method: 'POST' })
}

// --- Retours fournisseurs
export function listReturns(query: Page & { status?: ReceiptStatus; supplierId?: string; shopId?: string }) {
  return api<Paginated<SupplierReturn>>('/purchases/returns', { params: { ...query } })
}
export function getReturn(id: string) {
  return api<{ return: SupplierReturn }>(`/purchases/returns/${id}`)
}
export function createReturn(input: ReturnInput) {
  return api<{ return: SupplierReturn }>('/purchases/returns', { method: 'POST', body: input })
}
/** Le stock sort vers le fournisseur. */
export function validateReturn(id: string, idempotencyKey: string) {
  return api<{ return: SupplierReturn }>(`/purchases/returns/${id}/validate`, { method: 'POST', idempotencyKey })
}
export function cancelReturn(id: string) {
  return api<{ return: SupplierReturn }>(`/purchases/returns/${id}/cancel`, { method: 'POST' })
}

// --- Factures et paiements
export function listInvoices(query: Page & { status?: InvoiceStatus; supplierId?: string; overdue?: boolean }) {
  return api<Paginated<SupplierInvoice>>('/purchases/invoices', { params: { ...query, overdue: query.overdue || undefined } })
}
export function getInvoice(id: string) {
  return api<{ invoice: SupplierInvoice }>(`/purchases/invoices/${id}`)
}
export function createInvoice(input: InvoiceInput) {
  return api<{ invoice: SupplierInvoice }>('/purchases/invoices', { method: 'POST', body: input })
}
/** Jamais plus que le reste dû ; rejouable sans double paiement (clé d'idempotence). */
export function addPayment(invoiceId: string, input: PaymentInput, idempotencyKey: string) {
  return api<{ invoice: SupplierInvoice }>(`/purchases/invoices/${invoiceId}/payments`, { method: 'POST', body: input, idempotencyKey })
}
export function cancelInvoice(id: string) {
  return api<{ invoice: SupplierInvoice }>(`/purchases/invoices/${id}/cancel`, { method: 'POST' })
}
export function supplierBalances() {
  return api<{ balances: SupplierBalance[] }>('/purchases/supplier-balances')
}
