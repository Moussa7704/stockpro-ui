import type {
  Customer,
  CustomerDetail,
  CustomerInput,
  CustomerPayment,
  CustomerPaymentInput,
  Debtor,
  Expense,
  ExpenseCategory,
  ExpenseInput,
  ExpenseStatus,
  LedgerEntry,
  Statement,
} from '../types/customers'
import type { Paginated } from '../types/settings'
import { api } from './api'

// Clients (customers.manage), règlements (customer_payments.manage), impayés (reports.view),
// dépenses (expenses.manage).

interface Page {
  page: number
  pageSize: number
}

// --- Clients
export function listCustomers(query: Page & { search?: string; withDebt?: boolean; includeArchived?: boolean }) {
  return api<Paginated<Customer>>('/customers', {
    params: { ...query, withDebt: query.withDebt || undefined, includeArchived: query.includeArchived || undefined },
  })
}
export function getCustomer(id: string) {
  return api<{ customer: CustomerDetail }>(`/customers/${id}`)
}
export function createCustomer(input: CustomerInput) {
  return api<{ customer: Customer }>('/customers', { method: 'POST', body: input })
}
export function updateCustomer(id: string, input: Partial<CustomerInput>) {
  return api<{ customer: Customer }>(`/customers/${id}`, { method: 'PATCH', body: input })
}
export function listLedger(id: string, query: Page) {
  return api<Paginated<LedgerEntry>>(`/customers/${id}/ledger`, { params: { ...query } })
}
/** Relevé : solde d'ouverture, mouvements, solde de clôture (jours du fuseau de l'entreprise). */
export function getStatement(id: string, from: string, to: string) {
  return api<{ statement: Statement }>(`/customers/${id}/statement`, { params: { from, to } })
}
export function listCustomerPayments(id: string, query: Page) {
  return api<Paginated<CustomerPayment>>(`/customers/${id}/payments`, { params: { ...query } })
}
/** Règlement de dette : idempotence obligatoire, jamais plus que la dette. */
export function createCustomerPayment(customerId: string, input: CustomerPaymentInput, idempotencyKey: string) {
  return api<{ payment: CustomerPayment }>(`/customers/${customerId}/payments`, { method: 'POST', body: input, idempotencyKey })
}
export function listDebtors(query: Page & { minAmount?: string }) {
  return api<Paginated<Debtor> & { totalDebt: string }>('/customers/debtors', { params: { ...query } })
}

// --- Dépenses
export function listExpenseCategories(includeArchived = false) {
  return api<{ categories: ExpenseCategory[] }>('/expenses/categories', { params: includeArchived ? { includeArchived: true } : undefined })
}
export function createExpenseCategory(name: string) {
  return api<{ category: ExpenseCategory }>('/expenses/categories', { method: 'POST', body: { name } })
}
export function updateExpenseCategory(id: string, input: { name?: string; archived?: boolean }) {
  return api<{ category: ExpenseCategory }>(`/expenses/categories/${id}`, { method: 'PATCH', body: input })
}
export function listExpenses(query: Page & { shopId?: string; categoryId?: string; status?: ExpenseStatus; from?: string; to?: string }) {
  return api<Paginated<Expense> & { totalAmount: string }>('/expenses', { params: { ...query } })
}
export function createExpense(input: ExpenseInput, idempotencyKey: string) {
  return api<{ expense: Expense }>('/expenses', { method: 'POST', body: input, idempotencyKey })
}
/** Impossible une fois la session de caisse concernée clôturée. */
export function cancelExpense(id: string, reason: string, idempotencyKey: string) {
  return api<{ expense: Expense }>(`/expenses/${id}/cancel`, { method: 'POST', body: { reason }, idempotencyKey })
}
