import type { ShopSummary } from '../types/access'
import { api } from './api'

/** Boutiques accessibles à l'utilisateur connecté dans l'entreprise active. */
export function listShops() {
  return api<{ shops: ShopSummary[] }>('/shops')
}
