import type { MessageResponse, User, UserRole } from '../types/auth'
import { api } from './api'

// Gestion des comptes : routes réservées aux admins (403 sinon)

export function listUsers() {
  return api<{ users: User[] }>('/users')
}

/** Crée le compte sans mot de passe : la personne reçoit une invitation par email. */
export function createUser(input: { name: string; email: string; role: UserRole }) {
  return api<{ user: User }>('/users', { method: 'POST', body: input })
}

export function updateUserRole(id: string, role: UserRole) {
  return api<{ user: User }>(`/users/${id}`, { method: 'PATCH', body: { role } })
}

export function resendInvitation(id: string) {
  return api<MessageResponse>(`/users/${id}/invite`, { method: 'POST' })
}
