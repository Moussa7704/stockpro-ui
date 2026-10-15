import { createContext } from 'react'
import type { LoginChallengeResponse, User } from '../types/auth'

// loading : on ne sait pas encore si une session existe (appel /refresh en cours)
export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

// Ce que la page de vérification doit connaître pour valider ou renvoyer le code
export type OtpChallenge = Omit<LoginChallengeResponse, 'otpRequired'>

export interface AuthContextValue {
  user: User | null
  status: AuthStatus
  /** Étape 1 : vérifie le mot de passe et déclenche l'envoi du code par email. */
  login: (email: string, password: string) => Promise<OtpChallenge>
  /** Étape 2 : vérifie le code reçu ; ouvre la session s'il est bon. */
  verifyOtp: (challengeToken: string, code: string) => Promise<void>
  resendOtp: (challengeToken: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
