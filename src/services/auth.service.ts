import type {
  BackupCodesResponse,
  LoginResponse,
  LoginTwoFactorResponse,
  MeResponse,
  TwoFactorSetupResponse,
  User,
} from '../types/auth'
import { api } from './api'

export function register(input: { name: string; email: string; password: string }) {
  return api<{ user: User }>('/auth/register', { method: 'POST', body: input })
}

export function login(input: { email: string; password: string }) {
  return api<LoginResponse>('/auth/login', { method: 'POST', body: input })
}

export function loginWithTwoFactor(input: { challengeToken: string; code: string }) {
  return api<LoginTwoFactorResponse>('/auth/login/2fa', { method: 'POST', body: input })
}

export function logout() {
  return api<void>('/auth/logout', { method: 'POST' })
}

export function getMe() {
  return api<MeResponse>('/auth/me')
}

// ---------- Double authentification (utilisateur connecté) ----------

export function setupTwoFactor() {
  return api<TwoFactorSetupResponse>('/auth/2fa/setup', { method: 'POST' })
}

export function enableTwoFactor(code: string) {
  return api<BackupCodesResponse>('/auth/2fa/enable', { method: 'POST', body: { code } })
}

export function disableTwoFactor(input: { password: string; code: string }) {
  return api<{ twoFactorEnabled: false }>('/auth/2fa/disable', { method: 'POST', body: input })
}

export function regenerateBackupCodes(input: { password: string; code: string }) {
  return api<BackupCodesResponse>('/auth/2fa/backup-codes', { method: 'POST', body: input })
}
