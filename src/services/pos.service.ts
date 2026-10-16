import type { CashSession, Customer, Sale, SaleInput, SaleReturnInput, Ticket } from '../types/pos'
import type { Paginated } from '../types/settings'
import { api } from './api'

// Caisse : sessions (cash_sessions.manage), ventes (sales.create), annulations et retours
// (sales.cancel_refund), clients (customers.manage).

// --- Sessions de caisse
/** Ma session ouverte dans la boutique (null si la caisse n'est pas ouverte). */
export function currentSession(shopId: string) {
  return api<{ session: CashSession | null }>('/pos/sessions/current', { params: { shopId } })
}
export function openSession(shopId: string, openingFloat: string) {
  return api<{ session: CashSession }>('/pos/sessions', { method: 'POST', body: { shopId, openingFloat } })
}
export function getSession(id: string) {
  return api<{ session: CashSession }>(`/pos/sessions/${id}`)
}
/** Clôture : montant compté dans le tiroir, l'écart avec l'attendu est enregistré. */
export function closeSession(id: string, countedCash: string, notes?: string | null) {
  return api<{ session: CashSession }>(`/pos/sessions/${id}/close`, { method: 'POST', body: { countedCash, notes } })
}
export function listSessions(query: { page: number; pageSize: number; shopId?: string; status?: 'open' | 'closed' }) {
  return api<Paginated<CashSession>>('/pos/sessions', { params: { ...query } })
}

// --- Ventes
/** Clé d'idempotence OBLIGATOIRE : une vente rejouée après une coupure n'est jamais enregistrée deux fois. */
export function createSale(input: SaleInput, idempotencyKey: string) {
  return api<{ sale: Sale }>('/pos/sales', { method: 'POST', body: input, idempotencyKey })
}
export function listSales(query: { page: number; pageSize: number; shopId?: string; sessionId?: string; status?: 'completed' | 'cancelled' }) {
  return api<Paginated<Sale>>('/pos/sales', { params: { ...query } })
}
export function getSale(id: string) {
  return api<{ sale: Sale }>(`/pos/sales/${id}`)
}
export function getTicket(id: string) {
  return api<{ ticket: Ticket }>(`/pos/sales/${id}/ticket`)
}
export function cancelSale(id: string, reason: string, idempotencyKey: string) {
  return api<{ sale: Sale }>(`/pos/sales/${id}/cancel`, { method: 'POST', body: { reason }, idempotencyKey })
}
export function createSaleReturn(input: SaleReturnInput, idempotencyKey: string) {
  return api<{ return: { id: string; number: string; refundAmount: string } }>('/pos/returns', { method: 'POST', body: input, idempotencyKey })
}

// --- Clients (recherche en caisse, création rapide)
export function searchCustomers(search: string) {
  return api<Paginated<Customer>>('/customers', { params: { search, page: 1, pageSize: 10 } })
}
export function getCustomer(id: string) {
  return api<{ customer: Customer }>(`/customers/${id}`)
}
export function createCustomer(input: { name: string; phone?: string | null }) {
  return api<{ customer: Customer }>('/customers', { method: 'POST', body: input })
}
