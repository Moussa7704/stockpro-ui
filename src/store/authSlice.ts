import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { refreshAccessToken, setAccessToken } from '../services/api'
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
}

const initialState: AuthState = { status: 'loading', session: null }

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    sessionLoaded(state, action: PayloadAction<MeResponse>) {
      state.status = 'authenticated'
      state.session = action.payload
    },
    sessionCleared(state) {
      state.status = 'anonymous'
      state.session = null
    },
  },
})

export const { sessionLoaded, sessionCleared } = authSlice.actions
export const authReducer = authSlice.reducer

// --- Actions asynchrones (thunks simples : les ApiError remontent intactes, message compris)

/** Au chargement de l'application : le cookie de session (httpOnly) permet de retrouver la session. */
export function restoreSession(): AppThunk<Promise<void>> {
  return async (dispatch) => {
    const token = await refreshAccessToken()
    if (!token) {
      dispatch(sessionCleared())
      return
    }
    try {
      dispatch(sessionLoaded(await authService.getMe()))
    } catch {
      setAccessToken(null)
      dispatch(sessionCleared())
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

export function logout(): AppThunk<Promise<void>> {
  return async (dispatch, _getState, { queryClient }) => {
    try {
      await authService.logout()
    } finally {
      // Même si le serveur ne répond pas, on oublie la session côté navigateur
      setAccessToken(null)
      queryClient.clear()
      dispatch(sessionCleared())
    }
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
