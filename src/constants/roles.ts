import type { UserRole } from '../types/auth'

// Libellés et couleurs (Tag antd) des rôles, partagés par toutes les pages
export const ROLES: Record<UserRole, { label: string; color: string }> = {
  admin: { label: 'Administrateur', color: 'red' },
  manager: { label: 'Gestionnaire', color: 'blue' },
  employee: { label: 'Employé', color: 'default' },
}

export const ROLE_OPTIONS = (Object.keys(ROLES) as UserRole[]).map((role) => ({
  value: role,
  label: ROLES[role].label,
}))
