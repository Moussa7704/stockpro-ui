import type { RefreshResponse } from '../types/auth'

// L'access token reste en mémoire (pas de localStorage) : un script injecté (XSS)
// ne peut pas le lire. Au rechargement de la page, on le récupère via /refresh.
let accessToken: string | null = null

// Appelé quand la session ne peut plus être renouvelée (refresh token expiré ou révoqué)
let onSessionExpired: (() => void) | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler
}

export class ApiError extends Error {
  status: number
  details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

// Le serveur remplace le refresh token à chaque appel (rotation) : si deux requêtes
// expirent en même temps, elles doivent partager le même /refresh, sinon la seconde
// enverrait un cookie déjà utilisé et la session serait coupée
let refreshPromise: Promise<string | null> | null = null

export function refreshAccessToken(): Promise<string | null> {
  refreshPromise ??= fetch('/api/auth/refresh', { method: 'POST' })
    .then(async (res) => {
      if (!res.ok) return null
      const data = (await res.json()) as RefreshResponse
      return data.accessToken
    })
    .catch(() => null)
    .then((token) => {
      accessToken = token
      return token
    })
    .finally(() => {
      refreshPromise = null
    })

  return refreshPromise
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
}

export async function api<T>(path: string, options: ApiOptions = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  const sentToken = accessToken
  if (sentToken) headers.Authorization = `Bearer ${sentToken}`

  const res = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  // 401 alors qu'on avait envoyé un token : il a sûrement expiré (15 min).
  // On le renouvelle une seule fois puis on rejoue la requête.
  if (res.status === 401 && sentToken && retry) {
    const newToken = await refreshAccessToken()
    if (newToken) return api<T>(path, options, false)
    onSessionExpired?.()
  }

  if (res.status === 204) return undefined as T

  const data: unknown = await res.json().catch(() => null)

  if (!res.ok) {
    // Format d'erreur du serveur : { error: { message, details } }
    const error = (data as { error?: { message?: string; details?: unknown } } | null)?.error
    throw new ApiError(res.status, error?.message ?? 'Erreur réseau', error?.details)
  }

  return data as T
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    // Les messages du serveur sont rédigés pour l'utilisateur, y compris les 429
    // ("Patientez 42 secondes avant de redemander un code", "Trop de tentatives…")
    return error.message
  }
  return 'Impossible de joindre le serveur.'
}
