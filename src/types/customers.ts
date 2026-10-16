// Clients, compte client, relevés, impayés ; dépenses
import type { Customer } from './pos'

export type { Customer }

export interface CustomerDetail extends Customer {
  address: string | null
  notes: string | null
  availableCredit: string // plafond − dette (0 sans plafond)
  recentSales: { id: string; number: string; status: 'completed' | 'cancelled'; total: string; balanceDue: string; createdAt: string }[]
}

export interface CustomerInput {
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
  creditLimit?: string | null // null : aucun crédit ; modifiable seulement avec reports.view
  archived?: boolean
}

export const LEDGER_TYPES = ['sale_credit', 'sale_cancellation', 'payment', 'return_credit', 'adjustment'] as const
export type LedgerType = (typeof LEDGER_TYPES)[number]

// Écriture au compte client : + augmente la dette, − la diminue
export interface LedgerEntry {
  id: string
  type: LedgerType
  amount: string
  balanceAfter: string
  sourceType: string
  sourceId: string
  createdAt: string
}

export interface StatementEntry {
  id: string
  date: string
  type: LedgerType
  reference: string | null // n° de ticket, de retour, ou moyen de paiement
  debit: string
  credit: string
  balance: string
}

// GET /api/customers/:id/statement?from&to (jours du fuseau de l'entreprise)
export interface Statement {
  customer: { id: string; name: string; phone: string | null; email: string | null }
  currency: string
  timezone: string
  from: string
  to: string
  openingBalance: string
  totalDebits: string
  totalCredits: string
  closingBalance: string
  entries: StatementEntry[]
}

export interface CustomerPayment {
  id: string
  amount: string
  reference: string | null
  cashSessionId: string | null
  createdAt: string
  paymentMethod?: { id: string; code: string; name: string; type: string }
  customerBalance?: string // solde du client après le règlement
}

export interface CustomerPaymentInput {
  shopId: string
  paymentMethodId: string
  amount: string
  reference?: string | null
  notes?: string | null
}

// GET /api/customers/debtors : impayés et ancienneté (les règlements soldent d'abord le plus ancien)
export interface Debtor {
  id: string
  name: string
  phone: string | null
  balance: string
  creditLimit: string | null
  archived: boolean
  oldestUnpaidAt: string | null
  aging: { current: string; days31To60: string; days61To90: string; over90: string }
}

// --- Dépenses
export interface ExpenseCategory {
  id: string
  name: string
  archivedAt: string | null
}

export type ExpenseStatus = 'recorded' | 'cancelled'

export interface Expense {
  id: string
  shopId: string
  categoryId: string
  number: string // ex. BTQ1-DEP-2026-000001
  amount: string
  description: string
  spentAt: string // jour (AAAA-MM-JJ)
  paymentMethodId: string
  cashSessionId: string | null // payée depuis ce tiroir-caisse
  supplierId: string | null
  reference: string | null
  status: ExpenseStatus
  cancelReason: string | null
  createdAt: string
  category?: { id: string; name: string }
  paymentMethod?: { id: string; code: string; name: string; type: string }
}

export interface ExpenseInput {
  shopId: string
  categoryId: string
  amount: string
  description: string
  spentAt?: string
  paymentMethodId: string
  cashSessionId?: string | null
  supplierId?: string | null
  reference?: string | null
}
