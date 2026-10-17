import axios, { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import type { RefreshResponse } from '../types/auth'

// L'access token reste en mémoire (pas de localStorage) : un script injecté (XSS)
// ne peut pas le lire. Au rechargement de la page, on le récupère via /refresh.
let accessToken: string | null = null

// Appelé quand la session ne peut plus être renouvelée (refresh token expiré ou révoqué)
let onSessionExpired: (() => void) | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler
}

export class ApiError extends Error {
  /** 0 : le serveur n'a pas répondu (réseau coupé, API arrêtée…) */
  status: number
  details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

/**
 * Issue d'un renouvellement de session :
 * - ok : nouvel access token ;
 * - rejected : le serveur refuse la session (401 : cookie absent, expiré ou révoqué) → déconnexion ;
 * - unavailable : pas de réponse exploitable (réseau, serveur arrêté, 429, 5xx) → la session est
 *   peut-être toujours valide : on ne déconnecte SURTOUT pas, on réessaiera.
 */
export type RefreshResult = { status: 'ok'; token: string } | { status: 'rejected' } | { status: 'unavailable'; error: ApiError }

// Le serveur remplace le refresh token à chaque appel (rotation) : si deux requêtes
// expirent en même temps, elles doivent partager le même /refresh, sinon la seconde
// enverrait un cookie déjà utilisé et la session serait coupée
let refreshPromise: Promise<RefreshResult> | null = null

export function refreshSession(): Promise<RefreshResult> {
  // axios "nu" : surtout pas l'instance http, dont l'intercepteur rappellerait /refresh en boucle
  refreshPromise ??= axios
    .post<RefreshResponse>('/api/auth/refresh')
    .then((res): RefreshResult => {
      accessToken = res.data.accessToken
      return { status: 'ok', token: res.data.accessToken }
    })
    .catch(async (error: unknown): Promise<RefreshResult> => {
      if (error instanceof AxiosError && error.response?.status === 401) {
        accessToken = null
        return { status: 'rejected' }
      }
      return { status: 'unavailable', error: await toApiError(error) }
    })
    .finally(() => {
      refreshPromise = null
    })

  return refreshPromise
}

/** Instance axios de l'API : même origine (proxy Vite en dev), le cookie de session suit tout seul. */
export const http = axios.create({ baseURL: '/api' })

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean
}

http.interceptors.request.use((config) => {
  if (accessToken) config.headers.set('Authorization', `Bearer ${accessToken}`)
  return config
})

/**
 * Format d'erreur du serveur : { error: { message, details } } → ApiError lisible.
 * Pour un téléchargement (responseType blob), le message JSON arrive dans un Blob : on le relit.
 */
async function toApiError(error: unknown): Promise<ApiError> {
  if (error instanceof ApiError) return error
  if (error instanceof AxiosError && error.response) {
    let data: unknown = error.response.data
    if (typeof Blob !== 'undefined' && data instanceof Blob) {
      data = await data
        .text()
        .then((text) => JSON.parse(text) as unknown)
        .catch(() => null)
    }
    const body = data as { error?: { message?: string; details?: unknown } } | null
    return new ApiError(error.response.status, body?.error?.message ?? 'Erreur inattendue du serveur', body?.error?.details)
  }
  return new ApiError(0, 'Impossible de joindre le serveur.')
}

http.interceptors.response.use(undefined, async (error: unknown) => {
  const config = error instanceof AxiosError ? (error.config as RetriableConfig | undefined) : undefined
  const sentToken = config?.headers?.get?.('Authorization')

  // 401 alors qu'on avait envoyé un token : il a sûrement expiré (15 min).
  // On le renouvelle une seule fois puis on rejoue la requête.
  if (error instanceof AxiosError && error.response?.status === 401 && config && sentToken && !config._retried) {
    config._retried = true
    const refreshed = await refreshSession()
    if (refreshed.status === 'ok') {
      config.headers = AxiosHeaders.from(config.headers).set('Authorization', `Bearer ${refreshed.token}`)
      return http(config)
    }
    if (refreshed.status === 'rejected') onSessionExpired?.()
    // Serveur indisponible : la session est gardée, l'erreur du renouvellement est affichée
    else throw refreshed.error
  }
  throw await toApiError(error)
})

/**
 * Clé d'idempotence d'une opération sensible (vente, retour, règlement) : générée UNE fois par
 * opération et renvoyée telle quelle si on rejoue la requête après une coupure réseau.
 */
export function newIdempotencyKey(): string {
  return crypto.randomUUID()
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Paramètres d'URL (?page=2&search=riz) ; les valeurs undefined sont ignorées */
  params?: Record<string, unknown>
  idempotencyKey?: string
}

/** Appel JSON à l'API : renvoie les données, ou lève une ApiError au message prêt à afficher. */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const res = await http.request<T>({
    url: path,
    method: options.method ?? 'GET',
    data: options.body,
    params: options.params,
    headers: options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : undefined,
  })
  return (res.status === 204 ? undefined : res.data) as T
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    // Les messages du serveur sont rédigés pour l'utilisateur, y compris les 429
    // ("Patientez 42 secondes avant de redemander un code", "Trop de tentatives…")
    return error.message
  }
  return 'Impossible de joindre le serveur.'
}
