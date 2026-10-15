import type {
  LoginChallengeResponse,
  LoginOtpResponse,
  MeResponse,
  MessageResponse,
  PasswordTokenInfo,
  ResendOtpResponse,
} from '../types/auth'
import { api } from './api'

// Pas d'inscription publique : les comptes sont créés par un admin (users.service.ts)

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

export function getMe() {
  return api<MeResponse>('/auth/me')
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
