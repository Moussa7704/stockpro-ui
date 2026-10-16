import type {
  InviteMemberInput,
  Member,
  MemberPermissions,
  Permission,
  UpdateMemberInput,
} from '../types/access'
import type { MessageResponse } from '../types/auth'
import { api } from './api'

// Équipe de l'entreprise active : permission users.manage (403 sinon).
// Délégation encadrée côté serveur : on ne donne jamais plus que ses propres droits.

export function listMembers() {
  return api<{ members: Member[] }>('/members')
}

/** Compte inexistant : création + invitation par email à choisir son mot de passe. */
export function inviteMember(input: InviteMemberInput) {
  return api<{ member: Member }>('/members', { method: 'POST', body: input })
}

/** Rôle, boutiques ou statut (désactiver / réactiver). */
export function updateMember(id: string, input: UpdateMemberInput) {
  return api<{ member: Member }>(`/members/${id}`, { method: 'PATCH', body: input })
}

export function resendInvitation(id: string) {
  return api<MessageResponse>(`/members/${id}/invite`, { method: 'POST' })
}

export function getMemberPermissions(id: string) {
  return api<{ permissions: MemberPermissions }>(`/members/${id}/permissions`)
}

/** Remplace les ajustements du membre par rapport à son rôle (listes vides = rôle seul). */
export function setMemberPermissions(id: string, input: { grants: Permission[]; revokes: Permission[] }) {
  return api<{ permissions: MemberPermissions }>(`/members/${id}/permissions`, {
    method: 'PUT',
    body: input,
  })
}
