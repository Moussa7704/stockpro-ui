export type UserRole = 'admin' | 'manager' | 'employee'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  // true tant qu'un compte invité n'a pas encore choisi son mot de passe
  invitationPending: boolean
  createdAt: string
  updatedAt: string
}

// POST /api/auth/login : mot de passe correct → un code est envoyé par email,
// la session n'existe pas encore
export interface LoginChallengeResponse {
  otpRequired: true
  challengeToken: string
  sentTo: string // email masqué, ex. m****a@gmail.com
  expiresInSeconds: number
}

// POST /api/auth/login/otp : code correct → session ouverte
export interface LoginOtpResponse {
  user: User
  accessToken: string
}

// POST /api/auth/login/otp/resend
export interface ResendOtpResponse {
  resent: true
  expiresInSeconds: number
}

// POST /api/auth/refresh
export interface RefreshResponse {
  accessToken: string
}

// GET /api/auth/me
export interface MeResponse {
  user: User
}

// POST /api/auth/password/check : à quoi sert le lien reçu par email
export interface PasswordTokenInfo {
  purpose: 'invite' | 'reset'
  name: string
  email: string
}

// Réponses simples du serveur (mot de passe oublié, réinitialisation…)
export interface MessageResponse {
  message: string
}
