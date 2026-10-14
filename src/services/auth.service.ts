import type {
  LoginChallengeResponse,
  LoginOtpResponse,
  MeResponse,
  ResendOtpResponse,
  User,
} from '../types/auth'
import { api } from './api'

export function register(input: { name: string; email: string; password: string }) {
  return api<{ user: User }>('/auth/register', { method: 'POST', body: input })
}

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
