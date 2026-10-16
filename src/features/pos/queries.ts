import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../../lib/queryKeys'
import * as posService from '../../services/pos.service'

/** Ma session de caisse ouverte dans la boutique (null : caisse fermée). */
export function useCurrentSession(shopId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.pos.currentSession(shopId ?? 'none'),
    queryFn: async () => (await posService.currentSession(shopId!)).session,
    enabled: !!shopId,
    staleTime: 0,
  })
}

/** Session avec ses totaux à jour (espèces attendues…). */
export function useSession(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.pos.session(id ?? 'none'),
    queryFn: async () => (await posService.getSession(id!)).session,
    enabled: !!id,
    staleTime: 0,
  })
}

export function useTicket(saleId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.pos.ticket(saleId ?? 'none'),
    queryFn: async () => (await posService.getTicket(saleId!)).ticket,
    enabled: !!saleId,
  })
}
