import type { Permission } from '../types/access'
import type { MeResponse } from '../types/auth'

/** Réponse de GET /api/auth/me, personnalisable test par test. */
export function meResponse(
  options: { permissions?: Permission[]; roleCode?: string; companies?: number; allShops?: boolean; shopIds?: string[] } = {},
): MeResponse {
  const companies = Array.from({ length: options.companies ?? 1 }, (_, index) => ({
    id: `company-${index + 1}`,
    name: `Commerce ${index + 1}`,
    slug: `commerce-${index + 1}`,
    role: { code: options.roleCode ?? 'owner', name: 'Propriétaire' },
  }))
  return {
    user: {
      id: 'user-1',
      name: 'Awa Diop',
      email: 'awa@test.com',
      isPlatformAdmin: false,
      invitationPending: false,
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-01T10:00:00.000Z',
    },
    companies,
    activeCompany: {
      id: 'company-1',
      name: 'Commerce 1',
      role: { code: options.roleCode ?? 'owner', name: 'Propriétaire' },
      permissions: options.permissions ?? ['users.manage', 'roles.manage', 'company.manage'],
      allShops: options.allShops ?? true,
      shopIds: options.shopIds ?? [],
    },
  }
}

export const shopsFixture = [
  { id: 'shop-1', name: 'Boutique Centre', code: 'BTQ1' },
  { id: 'shop-2', name: 'Boutique Marché', code: 'BTQ2' },
]
