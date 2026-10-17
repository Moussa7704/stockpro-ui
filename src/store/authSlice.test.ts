import { http as mock, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { createQueryClient } from '../lib/queryClient'
import { api, getAccessToken, setAccessToken, setSessionExpiredHandler } from '../services/api'
import { meResponse } from '../test/fixtures'
import { server } from '../test/server'
import { logout, restoreSession, selectCan, sessionExpired, switchCompany, verifyOtp } from './authSlice'
import { makeStore } from './index'

function setup() {
  const queryClient = createQueryClient()
  // Une donnée en cache, pour vérifier qu'elle disparaît quand il le faut
  queryClient.setQueryData(['members'], ['ancien membre'])
  return { queryClient, store: makeStore({ queryClient }) }
}

describe('session (Redux Toolkit)', () => {
  it('au démarrage : session retrouvée grâce au cookie', async () => {
    const { store } = setup()
    server.use(
      mock.post('/api/auth/refresh', () => HttpResponse.json({ accessToken: 'token' })),
      mock.get('/api/auth/me', () => HttpResponse.json(meResponse({ permissions: ['stock.view'] }))),
    )

    await store.dispatch(restoreSession())

    expect(store.getState().auth.status).toBe('authenticated')
    expect(selectCan(store.getState(), 'stock.view')).toBe(true)
    expect(selectCan(store.getState(), 'users.manage')).toBe(false)
  })

  it('au démarrage sans session : visiteur anonyme', async () => {
    const { store } = setup()
    server.use(mock.post('/api/auth/refresh', () => HttpResponse.json({ error: { message: 'Session expirée' } }, { status: 401 })))

    await store.dispatch(restoreSession())

    expect(store.getState().auth).toEqual({ status: 'anonymous', session: null })
  })

  it('code OTP correct : token gardé en mémoire, droits chargés', async () => {
    const { store } = setup()
    server.use(
      mock.post('/api/auth/login/otp', () => HttpResponse.json({ accessToken: 'otp-token' })),
      mock.get('/api/auth/me', () => HttpResponse.json(meResponse())),
    )

    await store.dispatch(verifyOtp('challenge', '123456'))

    expect(getAccessToken()).toBe('otp-token')
    expect(store.getState().auth.session?.user.name).toBe('Awa Diop')
  })

  it('code OTP faux : l’erreur du serveur remonte intacte, rien ne change', async () => {
    const { store } = setup()
    server.use(mock.post('/api/auth/login/otp', () => HttpResponse.json({ error: { message: 'Code incorrect' } }, { status: 400 })))

    await expect(store.dispatch(verifyOtp('challenge', '000000'))).rejects.toMatchObject({ message: 'Code incorrect' })
    expect(store.getState().auth.status).toBe('loading')
  })

  it('changer d’entreprise vide le cache de l’ancienne entreprise', async () => {
    const { store, queryClient } = setup()
    server.use(
      mock.post('/api/auth/company', () => HttpResponse.json({ accessToken: 'company-2-token' })),
      mock.get('/api/auth/me', () => HttpResponse.json(meResponse({ companies: 2 }))),
    )

    await store.dispatch(switchCompany('company-2'))

    expect(getAccessToken()).toBe('company-2-token')
    expect(queryClient.getQueryData(['members'])).toBeUndefined()
  })

  it('déconnexion : session fermée par le serveur, tout est oublié', async () => {
    const { store, queryClient } = setup()
    setAccessToken('token')
    server.use(mock.post('/api/auth/logout', () => new HttpResponse(null, { status: 204 })))

    await store.dispatch(logout())

    expect(store.getState().auth.status).toBe('anonymous')
    expect(getAccessToken()).toBeNull()
    expect(queryClient.getQueryData(['members'])).toBeUndefined()
  })

  it('déconnexion sans réponse du serveur : on ne fait pas semblant, la session reste', async () => {
    const { store, queryClient } = setup()
    server.use(
      mock.post('/api/auth/refresh', () => HttpResponse.json({ accessToken: 'token' })),
      mock.get('/api/auth/me', () => HttpResponse.json(meResponse())),
    )
    await store.dispatch(restoreSession())
    server.use(mock.post('/api/auth/logout', () => HttpResponse.error()))

    await expect(store.dispatch(logout())).rejects.toMatchObject({ status: 0 })

    // Le cookie serait toujours valide : afficher la connexion serait mentir
    expect(store.getState().auth.status).toBe('authenticated')
    expect(getAccessToken()).toBe('token')
    expect(queryClient.getQueryData(['members'])).toEqual(['ancien membre'])
  })

  it('au démarrage, serveur saturé (429) ou arrêté : écran « réessayer », pas la connexion', async () => {
    const { store } = setup()
    server.use(mock.post('/api/auth/refresh', () => HttpResponse.json({ error: { message: 'Trop de requêtes, réessayez dans quelques minutes' } }, { status: 429 })))

    await store.dispatch(restoreSession())
    expect(store.getState().auth).toMatchObject({ status: 'unavailable', error: 'Trop de requêtes, réessayez dans quelques minutes' })

    server.use(mock.post('/api/auth/refresh', () => HttpResponse.error()))
    await store.dispatch(restoreSession())
    expect(store.getState().auth).toMatchObject({ status: 'unavailable', error: 'Impossible de joindre le serveur.' })

    // Le serveur répond de nouveau : la session est retrouvée
    server.use(
      mock.post('/api/auth/refresh', () => HttpResponse.json({ accessToken: 'token' })),
      mock.get('/api/auth/me', () => HttpResponse.json(meResponse())),
    )
    await store.dispatch(restoreSession())
    expect(store.getState().auth.status).toBe('authenticated')
    expect(store.getState().auth.error).toBeUndefined()
  })

  it('pendant l’utilisation : jeton expiré et renouvellement refusé (429) → session gardée, erreur affichée', async () => {
    const { store } = setup()
    server.use(
      mock.post('/api/auth/refresh', () => HttpResponse.json({ accessToken: 'token' })),
      mock.get('/api/auth/me', () => HttpResponse.json(meResponse())),
    )
    await store.dispatch(restoreSession())
    server.use(
      mock.get('/api/members', () => HttpResponse.json({ error: { message: 'Jeton expiré' } }, { status: 401 })),
      mock.post('/api/auth/refresh', () => HttpResponse.json({ error: { message: 'Trop de requêtes, réessayez dans quelques minutes' } }, { status: 429 })),
    )

    await expect(api('/members')).rejects.toMatchObject({ status: 429, message: 'Trop de requêtes, réessayez dans quelques minutes' })
    expect(store.getState().auth.status).toBe('authenticated')
  })

  it('pendant l’utilisation : renouvellement refusé (401) → déconnexion', async () => {
    const { store } = setup()
    let expired = 0
    setSessionExpiredHandler(() => {
      expired += 1
    })
    setAccessToken('token')
    server.use(
      mock.get('/api/members', () => HttpResponse.json({ error: { message: 'Jeton expiré' } }, { status: 401 })),
      mock.post('/api/auth/refresh', () => HttpResponse.json({ error: { message: 'Session invalide' } }, { status: 401 })),
    )

    await expect(api('/members')).rejects.toMatchObject({ status: 401 })
    expect(expired).toBe(1)
    expect(getAccessToken()).toBeNull()
    setSessionExpiredHandler(null)
    expect(store.getState().auth.status).toBe('loading')
  })

  it('session expirée pendant l’utilisation : retour à l’état anonyme', () => {
    const { store } = setup()
    setAccessToken('token')

    store.dispatch(sessionExpired())

    expect(store.getState().auth.status).toBe('anonymous')
    expect(getAccessToken()).toBeNull()
  })
})
