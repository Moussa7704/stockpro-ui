import type { RoleRef } from './auth'

// Liste alignée sur le serveur (src/modules/access/permissions.ts)
export type Permission =
  | 'company.manage'
  | 'users.manage'
  | 'roles.manage'
  | 'products.view'
  | 'products.manage'
  | 'prices.manage'
  | 'stock.view'
  | 'stock.adjust'
  | 'stock.transfer'
  | 'purchases.manage'
  | 'supplier_payments.manage'
  | 'sales.create'
  | 'sales.discount'
  | 'sales.price_override'
  | 'sales.cancel_refund'
  | 'cash_sessions.manage'
  | 'customers.manage'
  | 'customer_payments.manage'
  | 'expenses.manage'
  | 'reports.view'
  | 'audit.view'

// GET /api/permissions : catalogue groupé et libellé (cases à cocher)
export interface PermissionGroup {
  label: string
  permissions: { code: Permission; label: string }[]
}

// GET /api/roles
export interface Role {
  id: string
  code: string
  name: string
  description: string | null
  isSystem: boolean
  permissions: Permission[]
  memberCount: number
  // Modifiable par l'utilisateur connecté (le rôle propriétaire ne l'est jamais)
  editable: boolean
}

export interface RoleInput {
  name: string
  description?: string | null
  permissions: Permission[]
}

export interface ShopSummary {
  id: string
  name: string
  code: string
}

export type MembershipStatus = 'active' | 'disabled'

// GET /api/members
export interface Member {
  id: string // id de l'appartenance (membership), pas de l'utilisateur
  user: { id: string; name: string; email: string; invitationPending: boolean }
  role: RoleRef
  allShops: boolean
  shops: ShopSummary[]
  status: MembershipStatus
  // Ajustements propres à ce membre par rapport à son rôle
  permissionOverrides: { grants: Permission[]; revokes: Permission[] }
  // Droits effectifs = rôle + ajouts − retraits
  permissions: Permission[]
  // L'utilisateur connecté peut-il modifier ce membre ? (jamais lui-même, jamais plus puissant)
  editable: boolean
  createdAt: string
}

export interface InviteMemberInput {
  name: string
  email: string
  roleCode: string
  allShops?: boolean
  shopIds: string[]
}

export interface UpdateMemberInput {
  roleCode?: string
  allShops?: boolean
  shopIds?: string[]
  status?: MembershipStatus
}

// GET /api/members/:id/permissions
export interface MemberPermissions {
  memberId: string
  role: RoleRef & { permissions: Permission[] }
  grants: Permission[]
  revokes: Permission[]
  permissions: Permission[]
  editable: boolean
  // Ce que l'utilisateur connecté a le droit d'accorder ou de retirer
  grantable: Permission[]
}
