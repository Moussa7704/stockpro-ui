import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { ApiError, refreshSession, setAccessToken } from '../services/api'
import * as authService from '../services/auth.service'
import type { Permission } from '../types/access'
import type { AuthStatus, MeResponse } from '../types/auth'
import type { AppThunk, RootState } from './index'

/**
 * Session de l'utilisateur : qui il est, ses entreprises et ses droits dans l'entreprise active
 * (tout vient de GET /auth/me). L'access token, lui, reste hors du store (services/api.ts).
 */
interface AuthState {
  status: AuthStatus
  session: MeResponse | null
  /** Pourquoi la session n'a pas pu être vérifiée (status unavailable) */
  error?: string
}

const initialState: AuthState = { status: 'loading', session: null }

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    sessionLoaded(state, action: PayloadAction<MeResponse>) {
      state.status = 'authenticated'
      state.session = action.payload
      delete state.error
    },
    sessionCleared(state) {
      state.status = 'anonymous'
      state.session = null
      delete state.error
    },
    sessionChecking(state) {
      state.status = 'loading'
      delete state.error
    },
    sessionUnavailable(state, action: PayloadAction<string>) {
      state.status = 'unavailable'
      state.error = action.payload
    },
  },
})

export const { sessionLoaded, sessionCleared, sessionChecking, sessionUnavailable } = authSlice.actions
export const authReducer = authSlice.reducer

// --- Actions asynchrones (thunks simples : les ApiError remontent intactes, message compris)

/**
 * Au chargement de l'application : le cookie de session (httpOnly) permet de retrouver la session.
 * Seul un refus du serveur (401) mène à la connexion ; serveur injoignable → écran « réessayer ».
 */
export function restoreSession(): AppThunk<Promise<void>> {
  return async (dispatch) => {
    dispatch(sessionChecking())
    const refreshed = await refreshSession()
    if (refreshed.status === 'rejected') {
      dispatch(sessionCleared())
      return
    }
    if (refreshed.status === 'unavailable') {
      dispatch(sessionUnavailable(refreshed.error.message))
      return
    }
    try {
      dispatch(sessionLoaded(await authService.getMe()))
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAccessToken(null)
        dispatch(sessionCleared())
      } else {
        dispatch(sessionUnavailable(err instanceof Error ? err.message : 'Impossible de joindre le serveur.'))
      }
    }
  }
}

/** Étape 2 de la connexion : le code reçu par email ouvre la session. */
export function verifyOtp(challengeToken: string, code: string): AppThunk<Promise<void>> {
  return async (dispatch) => {
    const { accessToken } = await authService.loginWithOtp({ challengeToken, code })
    setAccessToken(accessToken)
    // La réponse du login ne contient pas les permissions : on les lit sur /me
    dispatch(sessionLoaded(await authService.getMe()))
  }
}

/** Change l'entreprise active : nouveaux droits, et plus rien en cache de l'ancienne entreprise. */
export function switchCompany(companyId: string): AppThunk<Promise<void>> {
  return async (dispatch, _getState, { queryClient }) => {
    const { accessToken } = await authService.switchCompany(companyId)
    setAccessToken(accessToken)
    queryClient.clear()
    dispatch(sessionLoaded(await authService.getMe()))
  }
}

/** Relit la session (nom de l'entreprise, droits) après un changement qui la concerne. */
export function reloadSession(): AppThunk<Promise<void>> {
  return async (dispatch) => {
    dispatch(sessionLoaded(await authService.getMe()))
  }
}

/**
 * Déconnexion : le serveur ferme la session et efface le cookie. S'il ne répond pas, on NE fait
 * PAS semblant : le cookie resterait valide et une actualisation reconnecterait. L'erreur remonte.
 */
export function logout(): AppThunk<Promise<void>> {
  return async (dispatch, _getState, { queryClient }) => {
    await authService.logout()
    setAccessToken(null)
    queryClient.clear()
    dispatch(sessionCleared())
  }
}

/** Session expirée pendant l'utilisation (refresh refusé) : retour à l'écran de connexion. */
export function sessionExpired(): AppThunk {
  return (dispatch, _getState, { queryClient }) => {
    setAccessToken(null)
    queryClient.clear()
    dispatch(sessionCleared())
  }
}

// --- Sélecteurs
export const selectAuthStatus = (state: RootState) => state.auth.status
export const selectSession = (state: RootState) => state.auth.session
export const selectActiveCompany = (state: RootState) => state.auth.session?.activeCompany ?? null

/** Confort d'affichage (menus, boutons) : l'API revérifie chaque permission. */
export const selectCan = (state: RootState, permission: Permission) =>
  state.auth.session?.activeCompany?.permissions.includes(permission) ?? false
