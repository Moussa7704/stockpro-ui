import { createContext } from 'react'
import type { User } from '../types/auth'

// loading : on ne sait pas encore si une session existe (appel /refresh en cours)
export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

export type LoginResult = { twoFactorRequired: false } | { twoFactorRequired: true; challengeToken: string }

export interface AuthContextValue {
  user: User | null
  status: AuthStatus
  login: (email: string, password: string) => Promise<LoginResult>
  verifyTwoFactor: (challengeToken: string, code: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
