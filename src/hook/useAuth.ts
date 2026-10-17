import { useMemo } from 'react'
import * as authService from '../services/auth.service'
import * as session from '../store/authSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import type { Permission } from '../types/access'
import type { OtpChallenge } from '../types/auth'

/**
 * Session de l'utilisateur et actions de connexion. L'état vit dans le store Redux Toolkit
 * (store/authSlice.ts) ; ce hook garde une interface simple pour les pages.
 */
export function useAuth() {
  const dispatch = useAppDispatch()
  const status = useAppSelector(session.selectAuthStatus)
  const me = useAppSelector(session.selectSession)

  return useMemo(() => {
    const permissions = new Set<Permission>(me?.activeCompany?.permissions ?? [])
    return {
      user: me?.user ?? null,
      status,
      /** Entreprises dont l'utilisateur est membre actif. */
      companies: me?.companies ?? [],
      /** Entreprise active et droits de l'utilisateur dedans (null : à choisir). */
      activeCompany: me?.activeCompany ?? null,
      /** Confort d'affichage (menus, boutons) : l'API revérifie chaque permission. */
      can: (permission: Permission) => permissions.has(permission),
      /** Étape 1 : vérifie le mot de passe et déclenche l'envoi du code par email. */
      login: async (email: string, password: string): Promise<OtpChallenge> => {
        // Pas encore de session : le serveur a seulement envoyé un code par email
        const { challengeToken, sentTo, expiresInSeconds } = await authService.login({ email, password })
        return { challengeToken, sentTo, expiresInSeconds }
      },
      /** Étape 2 : vérifie le code reçu ; ouvre la session s'il est bon. */
      verifyOtp: (challengeToken: string, code: string) => dispatch(session.verifyOtp(challengeToken, code)),
      resendOtp: async (challengeToken: string) => {
        await authService.resendOtp(challengeToken)
      },
      /** Change l'entreprise active et recharge les droits. */
      switchCompany: (companyId: string) => dispatch(session.switchCompany(companyId)),
      /** Rejette si le serveur ne répond pas : la session reste ouverte, à signaler à l'utilisateur. */
      logout: () => dispatch(session.logout()),
    }
  }, [dispatch, status, me])
}
