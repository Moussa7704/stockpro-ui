// Caisse : sessions, ventes, paiements, retours clients, clients

export type Discount = { type: 'amount'; value: string } | { type: 'percent'; value: string }

export interface SessionSummary {
  salesCount: number
  salesTotal: string
  byMethod: { methodId: string; name: string; type: string; amount: string }[]
  cashRefunds: string
  customerPayments: string
  cashCustomerPayments: string
  cashExpenses: string
  // Fond de caisse + encaissements en espèces − remboursements et dépenses payés du tiroir
  expectedCash: string
}

export interface CashSession {
  id: string
  shopId: string
  cashierId: string
  status: 'open' | 'closed'
  openedAt: string
  openingFloat: string
  closedAt: string | null
  expectedCash: string | null
  countedCash: string | null
  difference: string | null // compté − attendu (négatif : manque)
  notes: string | null
  summary?: SessionSummary
}

export interface SaleLine {
  id: string
  productId: string
  quantity: string
  unitPrice: string
  discount: string
  lineTotal: string
  returnedQuantity: string
  product: { id: string; sku: string; name: string; barcode: string | null }
}

export interface SalePayment {
  id: string
  amount: string
  reference: string | null
  paymentMethod: { id: string; code: string; name: string; type: string }
}

export interface Sale {
  id: string
  shopId: string
  cashSessionId: string
  number: string // ex. BTQ1-T-2026-000123
  status: 'completed' | 'cancelled'
  subtotal: string
  discountTotal: string
  total: string
  amountPaid: string
  changeGiven: string // monnaie rendue
  balanceDue: string // reste dû (vente à crédit)
  notes: string | null
  createdBy: string
  cancelReason: string | null
  createdAt: string
  customer: { id: string; name: string; phone?: string | null } | null
  lines?: SaleLine[]
  payments?: SalePayment[]
}

export interface SaleInput {
  shopId: string
  customerId?: string | null
  lines: { productId: string; quantity: string; unitPrice?: string; discount?: Discount }[]
  discount?: Discount
  payments: { methodId: string; amount: string; reference?: string }[]
  notes?: string | null
}

export interface Ticket {
  number: string
  status: string
  total: string
  changeGiven: string
  balanceDue: string
  text: string // version 42 colonnes pour imprimante thermique
}

export interface SaleReturnInput {
  saleId: string
  reason: string
  lines: { saleLineId: string; quantity: string; restock: boolean }[]
  refundTo: 'method' | 'customer_account'
  refundMethodId?: string
}

export interface Customer {
  id: string
  name: string
  phone: string | null
  email: string | null
  creditLimit: string | null // null : aucun crédit autorisé
  balance: string // dette actuelle
  availableCredit?: string // fiche détaillée : plafond − dette
  archivedAt: string | null
}
