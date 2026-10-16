import type { PermissionGroup, Role, RoleInput } from '../types/access'
import { api } from './api'

// Lecture pour tous les membres ; création / modification / suppression avec roles.manage

/** Catalogue des permissions, groupées et libellées (cases à cocher). */
export function getPermissionCatalog() {
  return api<{ groups: PermissionGroup[] }>('/permissions')
}

export function listRoles() {
  return api<{ roles: Role[] }>('/roles')
}

export function createRole(input: RoleInput) {
  return api<{ role: Role }>('/roles', { method: 'POST', body: input })
}

/** S'applique immédiatement à tous les membres qui ont ce rôle. */
export function updateRole(id: string, input: Partial<RoleInput>) {
  return api<{ role: Role }>(`/roles/${id}`, { method: 'PATCH', body: input })
}

/** Rôle personnalisé que plus personne n'utilise. */
export function deleteRole(id: string) {
  return api<void>(`/roles/${id}`, { method: 'DELETE' })
}
