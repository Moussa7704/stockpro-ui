export type UserRole = 'admin' | 'manager' | 'employee'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
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
