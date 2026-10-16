import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { refreshAccessToken, setAccessToken, setSessionExpiredHandler } from '../services/api'
import * as authService from '../services/auth.service'
import type { Permission } from '../types/access'
import type { MeResponse } from '../types/auth'
import { AuthContext, type AuthContextValue, type AuthStatus, type OtpChallenge } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  // user, entreprises et droits viennent tous de GET /auth/me
  const [session, setSession] = useState<MeResponse | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  const clearSession = useCallback(() => {
    setAccessToken(null)
    setSession(null)
    setStatus('anonymous')
  }, [])

  // Le token est déjà en mémoire (api.ts) : on charge l'utilisateur et ses droits
  const loadSession = useCallback(async () => {
    const me = await authService.getMe()
    setSession(me)
    setStatus('authenticated')
  }, [])

  // Au chargement : le cookie refreshToken (httpOnly) permet de retrouver la session
  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      const token = await refreshAccessToken()
      if (!token) {
        if (!cancelled) clearSession()
        return
      }
      try {
        const me = await authService.getMe()
        if (!cancelled) {
          setSession(me)
          setStatus('authenticated')
        }
      } catch {
        if (!cancelled) clearSession()
      }
    }

    restoreSession()
    return () => {
      cancelled = true
    }
  }, [clearSession])

  // Session expirée pendant l'utilisation (refresh refusé) : retour à l'écran de connexion
  useEffect(() => {
    setSessionExpiredHandler(clearSession)
    return () => setSessionExpiredHandler(null)
  }, [clearSession])

  const login = useCallback(async (email: string, password: string): Promise<OtpChallenge> => {
    // Pas encore de session : le serveur a seulement envoyé un code par email
    const { challengeToken, sentTo, expiresInSeconds } = await authService.login({ email, password })
    return { challengeToken, sentTo, expiresInSeconds }
  }, [])

  const verifyOtp = useCallback(
    async (challengeToken: string, code: string) => {
      const { accessToken } = await authService.loginWithOtp({ challengeToken, code })
      setAccessToken(accessToken)
      // La réponse du login ne contient pas les permissions : on les lit sur /me
      await loadSession()
    },
    [loadSession],
  )

  const resendOtp = useCallback(async (challengeToken: string) => {
    await authService.resendOtp(challengeToken)
  }, [])

  const switchCompany = useCallback(
    async (companyId: string) => {
      const { accessToken } = await authService.switchCompany(companyId)
      setAccessToken(accessToken)
      await loadSession()
    },
    [loadSession],
  )

  const logout = useCallback(async () => {
    try {
      await authService.logout()
    } finally {
      // Même si le serveur ne répond pas, on oublie la session côté navigateur
      clearSession()
    }
  }, [clearSession])

  const value = useMemo<AuthContextValue>(() => {
    const permissions = new Set<Permission>(session?.activeCompany?.permissions ?? [])
    return {
      user: session?.user ?? null,
      status,
      companies: session?.companies ?? [],
      activeCompany: session?.activeCompany ?? null,
      can: (permission) => permissions.has(permission),
      login,
      verifyOtp,
      resendOtp,
      switchCompany,
      logout,
    }
  }, [session, status, login, verifyOtp, resendOtp, switchCompany, logout])

  return <AuthContext value={value}>{children}</AuthContext>
}
