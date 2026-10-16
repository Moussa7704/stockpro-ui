// Achats : bons de commande, réceptions, retours, factures et paiements fournisseurs
import type { ProductRef } from './stock'

export type OrderStatus = 'draft' | 'sent' | 'partially_received' | 'received' | 'closed' | 'cancelled'

export interface PurchaseOrderLine {
  id: string
  productId: string
  quantityOrdered: string
  quantityReceived: string
  quantityRemaining?: string // fourni par le détail : commandé − reçu
  unitCost: string
  lineTotal: string
  product: ProductRef
}

export interface PurchaseOrder {
  id: string
  shopId: string
  supplierId: string
  number: string // ex. BTQ1-BC-2026-000001
  status: OrderStatus
  expectedAt: string | null // jour de livraison prévu (AAAA-MM-JJ)
  notes: string | null
  total: string
  sentAt: string | null
  closedAt: string | null
  createdAt: string
  supplier?: { id: string; name: string }
  lines?: PurchaseOrderLine[]
}

/** Ligne chiffrée envoyée à l'API (commande, réception, retour). */
export interface PricedLineInput {
  productId: string
  quantity: string
  unitCost: string
}

export interface OrderInput {
  shopId: string
  supplierId: string
  expectedAt?: string | null
  notes?: string | null
  lines: PricedLineInput[]
}

export type ReceiptStatus = 'draft' | 'validated' | 'cancelled'

export interface GoodsReceipt {
  id: string
  shopId: string
  supplierId: string
  orderId: string | null
  number: string // ex. BTQ1-REC-2026-000001
  status: ReceiptStatus
  supplierReference: string | null // n° du bon de livraison du fournisseur
  notes: string | null
  total: string
  validatedAt: string | null
  createdAt: string
  lines?: { id: string; productId: string; orderLineId: string | null; quantity: string; unitCost: string; lineTotal: string; product: ProductRef }[]
}

export interface ReceiptInput {
  shopId: string
  supplierId: string
  orderId?: string
  supplierReference?: string | null
  notes?: string | null
  // Facultatif pour une réception de commande : sans lignes, tout le reste à recevoir est repris
  lines?: (PricedLineInput & { orderLineId?: string })[]
}

export interface SupplierReturn {
  id: string
  shopId: string
  supplierId: string
  receiptId: string | null
  number: string // ex. BTQ1-RF-2026-000001
  status: ReceiptStatus
  reason: string
  notes: string | null
  total: string
  validatedAt: string | null
  createdAt: string
  lines?: { id: string; productId: string; quantity: string; unitCost: string | null; lineTotal: string | null; product: ProductRef }[]
}

export interface ReturnInput {
  shopId: string
  supplierId: string
  reason: string
  notes?: string | null
  // Sans coût : valorisé au coût moyen du stock à la validation
  lines: { productId: string; quantity: string; unitCost?: string }[]
}

export type InvoiceStatus = 'unpaid' | 'partially_paid' | 'paid' | 'cancelled'

export const SUPPLIER_PAYMENT_METHODS = ['cash', 'bank_transfer', 'mobile_money', 'check', 'other'] as const
export type SupplierPaymentMethod = (typeof SUPPLIER_PAYMENT_METHODS)[number]

export interface SupplierPayment {
  id: string
  amount: string
  method: SupplierPaymentMethod
  paidAt: string
  reference: string | null
  notes: string | null
  createdAt: string
}

export interface SupplierInvoice {
  id: string
  supplierId: string
  receiptId: string | null
  reference: string // n° de facture du fournisseur
  invoiceDate: string
  dueDate: string | null
  total: string
  amountPaid: string
  remaining: string // reste dû
  overdue: boolean // échue et pas soldée
  status: InvoiceStatus
  notes: string | null
  createdAt: string
  supplier?: { id: string; name: string }
  payments?: SupplierPayment[]
}

export interface InvoiceInput {
  supplierId: string
  reference: string
  invoiceDate: string
  dueDate?: string | null
  total: string
  notes?: string | null
}

export interface PaymentInput {
  amount: string
  method: SupplierPaymentMethod
  paidAt?: string
  reference?: string | null
  notes?: string | null
}

// GET /api/purchases/supplier-balances : ce que l'on doit à chaque fournisseur
export interface SupplierBalance {
  supplier: { id: string; name: string }
  invoiced: string
  paid: string
  outstanding: string
  overdue: string
  openInvoices: number
}
