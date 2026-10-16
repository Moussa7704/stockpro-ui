import { selectCan } from '../store/authSlice'
import { useAppSelector } from '../store/hooks'
import type { Permission } from '../types/access'

/**
 * L'utilisateur a-t-il cette permission dans l'entreprise active ?
 * Sert à afficher ou masquer menus et boutons : l'API revérifie toujours.
 *   const canAdjust = usePermission('stock.adjust')
 */
export function usePermission(permission: Permission): boolean {
  return useAppSelector((state) => selectCan(state, permission))
}
