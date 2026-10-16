import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../../lib/queryKeys'
import * as rolesService from '../../services/roles.service'

export function useRoles() {
  return useQuery({
    queryKey: queryKeys.roles.all,
    queryFn: async () => (await rolesService.listRoles()).roles,
  })
}

/** Catalogue des permissions : fixe pendant toute la session. */
export function usePermissionCatalog() {
  return useQuery({
    queryKey: queryKeys.permissionCatalog,
    queryFn: async () => (await rolesService.getPermissionCatalog()).groups,
    staleTime: Infinity,
  })
}
