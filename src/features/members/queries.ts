import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../../lib/queryKeys'
import * as membersService from '../../services/members.service'

/** Équipe de l'entreprise active (permission users.manage). */
export function useMembers() {
  return useQuery({
    queryKey: queryKeys.members.all,
    queryFn: async () => (await membersService.listMembers()).members,
  })
}

/** Droits détaillés d'un membre : rôle, ajouts, retraits, ce que l'on peut accorder. */
export function useMemberPermissions(memberId: string) {
  return useQuery({
    queryKey: queryKeys.members.permissions(memberId),
    queryFn: async () => (await membersService.getMemberPermissions(memberId)).permissions,
    // Toujours relu à l'ouverture : un autre responsable a pu changer ces droits
    staleTime: 0,
  })
}
