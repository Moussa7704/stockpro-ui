// Paramètres de l'entreprise, boutiques, moyens de paiement et journal d'audit

export interface CompanySettings {
  // Remise maximale qu'un caissier peut accorder sans la permission sales.discount
  maxCashierDiscountPercent?: number
  // Couleur de l'interface (#rrggbb) ; null : couleur StockPro
  brandColor?: string | null
}

// GET /api/company : entreprise active
export interface Company {
  id: string
  name: string
  slug: string
  currency: string // XOF : une seule devise en V1, non modifiable
  timezone: string // ex. Africa/Abidjan : les rapports raisonnent en jours de ce fuseau
  status: 'active' | 'suspended'
  settings: CompanySettings
  createdAt: string
  updatedAt: string
}

export interface UpdateCompanyInput {
  name?: string
  timezone?: string
  settings?: CompanySettings
}

// GET /api/shops : boutique complète (ShopSummary en est un sous-ensemble)
export interface Shop {
  id: string
  name: string
  code: string // court, en majuscules : sert dans les numéros de documents (BTQ1-T-2026-000123)
  address: string | null
  phone: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ShopInput {
  name: string
  code: string
  address?: string | null
  phone?: string | null
}

export const PAYMENT_METHOD_TYPES = ['cash', 'mobile_money', 'card', 'bank', 'other'] as const
export type PaymentMethodType = (typeof PAYMENT_METHOD_TYPES)[number]

// GET /api/payment-methods
export interface PaymentMethod {
  id: string
  code: string
  name: string
  // "cash" : les espèces comptent dans le tiroir-caisse (clôture de session)
  type: PaymentMethodType
  active: boolean
  sortOrder: number
}

export interface CreatePaymentMethodInput {
  code: string
  name: string
  type: PaymentMethodType
  sortOrder?: number
}

export interface UpdatePaymentMethodInput {
  name?: string
  active?: boolean
  sortOrder?: number
}

// GET /api/audit-logs
export interface AuditLogEntry {
  id: string
  shopId: string | null
  action: string // ex. "member.permissions_update"
  entityType: string | null
  entityId: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  ip: string | null
  createdAt: string
  actor: { id: string; name: string | null; email: string | null } | null
}

/** Réponse paginée commune aux listes de l'API. */
export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
