import type {
  AccountSession,
  LoginChallengeResponse,
  LoginOtpResponse,
  MeResponse,
  MessageResponse,
  PasswordTokenInfo,
  RefreshResponse,
  ResendOtpResponse,
} from '../types/auth'
import { api } from './api'

// Pas d'inscription publique : le propriétaire invite son équipe (members.service.ts)

// Étape 1 : email + mot de passe → code envoyé par email
export function login(input: { email: string; password: string }) {
  return api<LoginChallengeResponse>('/auth/login', { method: 'POST', body: input })
}

// Étape 2 : code reçu par email → session
export function loginWithOtp(input: { challengeToken: string; code: string }) {
  return api<LoginOtpResponse>('/auth/login/otp', { method: 'POST', body: input })
}

export function resendOtp(challengeToken: string) {
  return api<ResendOtpResponse>('/auth/login/otp/resend', {
    method: 'POST',
    body: { challengeToken },
  })
}

export function logout() {
  return api<void>('/auth/logout', { method: 'POST' })
}

/** Appareils connectés de l'utilisateur, celui-ci en premier. */
export function listSessions() {
  return api<{ sessions: AccountSession[] }>('/auth/sessions')
}

/** Déconnecte un autre appareil : effet immédiat. */
export function revokeSession(id: string) {
  return api<void>(`/auth/sessions/${id}`, { method: 'DELETE' })
}

export function revokeOtherSessions() {
  return api<{ revoked: number }>('/auth/sessions/revoke-others', { method: 'POST' })
}

export function getMe() {
  return api<MeResponse>('/auth/me')
}

/** Change l'entreprise active : nouvel access token, la session retient ce choix. */
export function switchCompany(companyId: string) {
  return api<RefreshResponse>('/auth/company', { method: 'POST', body: { companyId } })
}

// ---------- Mot de passe ----------

/** Envoie un lien de réinitialisation (réponse identique que l'email existe ou non). */
export function forgotPassword(email: string) {
  return api<MessageResponse>('/auth/password/forgot', { method: 'POST', body: { email } })
}

/** Vérifie un lien reçu par email (invitation ou réinitialisation) avant d'afficher le formulaire. */
export function checkPasswordToken(token: string) {
  return api<PasswordTokenInfo>('/auth/password/check', { method: 'POST', body: { token } })
}

export function resetPassword(input: { token: string; password: string }) {
  return api<MessageResponse>('/auth/password/reset', { method: 'POST', body: input })
}

/** Utilisateur connecté : la session en cours est gardée, les autres appareils sont déconnectés. */
export function changePassword(input: { currentPassword: string; newPassword: string }) {
  return api<MessageResponse>('/auth/password/change', { method: 'POST', body: input })
}
