import type { Role } from '../types/access'
import type { ActiveCompany } from '../types/auth'

// Le propriétaire a toujours toutes les permissions ; son rôle n'est pas modifiable
export const OWNER_ROLE_CODE = 'owner'

/**
 * Même règle que le serveur (access/delegation.ts) : on n'attribue qu'un rôle
 * entièrement inclus dans ses propres droits ; seul un propriétaire attribue le rôle de propriétaire.
 * Sert à filtrer les listes déroulantes : l'API revérifie de toute façon.
 */
export function canAssignRole(actor: ActiveCompany, role: Pick<Role, 'code' | 'permissions'>): boolean {
  if (actor.role.code === OWNER_ROLE_CODE) return true
  if (role.code === OWNER_ROLE_CODE) return false
  return role.permissions.every((permission) => actor.permissions.includes(permission))
}
