import type { Shop, ShopInput } from '../types/settings'
import { api } from './api'

/**
 * Boutiques de l'entreprise active : chacun voit celles de son périmètre ;
 * création et modification avec company.manage (qui peut aussi voir les archivées).
 */
export function listShops(options: { includeArchived?: boolean } = {}) {
  return api<{ shops: Shop[] }>('/shops', { params: options.includeArchived ? { includeArchived: true } : undefined })
}

export function createShop(input: ShopInput) {
  return api<{ shop: Shop }>('/shops', { method: 'POST', body: input })
}

/** archived: true archive la boutique (plus de ventes ni de mouvements), false la rouvre. */
export function updateShop(id: string, input: Partial<ShopInput> & { archived?: boolean }) {
  return api<{ shop: Shop }>(`/shops/${id}`, { method: 'PATCH', body: input })
}
