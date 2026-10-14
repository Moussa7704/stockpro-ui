import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { refreshAccessToken, setAccessToken, setSessionExpiredHandler } from '../services/api'
import * as authService from '../services/auth.service'
import type { User } from '../types/auth'
import { AuthContext, type AuthContextValue, type AuthStatus, type OtpChallenge } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  const signIn = useCallback((nextUser: User, accessToken: string) => {
    setAccessToken(accessToken)
    setUser(nextUser)
    setStatus('authenticated')
  }, [])

  const clearSession = useCallback(() => {
    setAccessToken(null)
    setUser(null)
    setStatus('anonymous')
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
        const { user: me } = await authService.getMe()
        if (!cancelled) signIn(me, token)
      } catch {
        if (!cancelled) clearSession()
      }
    }

    restoreSession()
    return () => {
      cancelled = true
    }
  }, [clearSession, signIn])

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
      const result = await authService.loginWithOtp({ challengeToken, code })
      signIn(result.user, result.accessToken)
    },
    [signIn],
  )

  const resendOtp = useCallback(async (challengeToken: string) => {
    await authService.resendOtp(challengeToken)
  }, [])

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      await authService.register({ name, email, password })
      // Même pour un compte neuf, la connexion passe par le code envoyé par email
      return login(email, password)
    },
    [login],
  )

  const logout = useCallback(async () => {
    try {
      await authService.logout()
    } finally {
      // Même si le serveur ne répond pas, on oublie la session côté navigateur
      clearSession()
    }
  }, [clearSession])

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, verifyOtp, resendOtp, register, logout }),
    [user, status, login, verifyOtp, resendOtp, register, logout],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
