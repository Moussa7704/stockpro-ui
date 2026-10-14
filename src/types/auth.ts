export type UserRole = 'admin' | 'manager' | 'employee'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  createdAt: string
  updatedAt: string
}

// POST /api/auth/login : deux réponses possibles selon que la 2FA est activée ou non
export type LoginResponse =
  | { twoFactorRequired: false; user: User; accessToken: string }
  | { twoFactorRequired: true; challengeToken: string }

// POST /api/auth/login/2fa
export interface LoginTwoFactorResponse {
  user: User
  accessToken: string
  backupCodesRemaining?: number
}

// POST /api/auth/refresh
export interface RefreshResponse {
  accessToken: string
}

// GET /api/auth/me
export interface MeResponse {
  user: User
  twoFactorEnabled: boolean
}

// POST /api/auth/2fa/setup
export interface TwoFactorSetupResponse {
  secret: string // à saisir à la main si le QR code ne peut pas être scanné
  otpauthUrl: string
  qrCode: string // image PNG en data URL, utilisable directement dans <img src>
}

// POST /api/auth/2fa/enable et /2fa/backup-codes
export interface BackupCodesResponse {
  backupCodes: string[]
}
