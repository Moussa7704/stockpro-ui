// Back-office de la plateforme (administrateur SaaS) : les commerçants abonnés
import type { CompanySettings } from './settings'

export type CompanyStatus = 'active' | 'suspended'

export interface PlatformCompany {
  id: string
  name: string
  slug: string
  currency: string
  timezone: string
  status: CompanyStatus
  settings: CompanySettings
  createdAt: string
  updatedAt: string
}

// GET /api/platform/companies
export type PlatformCompanySummary = PlatformCompany & { activeMembers: number }

export interface PlatformMember {
  membershipId: string
  status: 'active' | 'disabled'
  role: { code: string; name: string }
  user: PlatformOwner
}

export interface PlatformOwner {
  id: string
  name: string
  email: string
  /** Compte pas encore activé : le mot de passe n'a jamais été choisi */
  invitationPending: boolean
}

// GET /api/platform/companies/:id
export interface PlatformCompanyDetail extends PlatformCompany {
  shops: { id: string; name: string; code: string; archivedAt: string | null }[]
  members: PlatformMember[]
  /** Premier propriétaire actif (null : aucun) */
  owner: PlatformOwner | null
}

// POST /api/platform/companies
export interface CreateCompanyInput {
  name: string
  slug?: string
  timezone: string
  shopName: string
  owner: { name: string; email: string }
}
