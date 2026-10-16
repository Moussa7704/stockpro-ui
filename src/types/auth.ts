import type { Permission } from './access'

export interface User {
  id: string
  name: string
  email: string
  // Administrateur de la plateforme SaaS (back-office), indépendant des entreprises
  isPlatformAdmin: boolean
  // true tant qu'un compte invité n'a pas encore choisi son mot de passe
  invitationPending: boolean
  createdAt: string
  updatedAt: string
}

// Rôle d'un membre dans une entreprise (rôle système ou personnalisé)
export interface RoleRef {
  code: string
  name: string
}

// Entreprise dont l'utilisateur est membre (sélecteur d'entreprise)
export interface CompanySummary {
  id: string
  name: string
  slug: string
  role: RoleRef
}

// Droits dans l'entreprise active : servent à afficher menus et boutons.
// Confort d'affichage uniquement : l'API revérifie tout.
export interface ActiveCompany {
  id: string
  name: string
  role: RoleRef
  permissions: Permission[]
  allShops: boolean
  shopIds: string[]
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
  companies: CompanySummary[]
  // Choisie automatiquement s'il n'y a qu'une entreprise ; sinon null → POST /auth/company
  activeCompanyId: string | null
  accessToken: string
}

// POST /api/auth/login/otp/resend
export interface ResendOtpResponse {
  resent: true
  expiresInSeconds: number
}

// POST /api/auth/refresh et POST /api/auth/company
export interface RefreshResponse {
  accessToken: string
}

// GET /api/auth/me
export interface MeResponse {
  user: User
  companies: CompanySummary[]
  activeCompany: ActiveCompany | null
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
