import { http as mock, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { createQueryClient } from '../lib/queryClient'
import { getAccessToken, setAccessToken } from '../services/api'
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

  it('déconnexion : tout est oublié, même si le serveur ne répond pas', async () => {
    const { store, queryClient } = setup()
    setAccessToken('token')
    server.use(mock.post('/api/auth/logout', () => HttpResponse.error()))

    await store.dispatch(logout()).catch(() => undefined)

    expect(store.getState().auth.status).toBe('anonymous')
    expect(getAccessToken()).toBeNull()
    expect(queryClient.getQueryData(['members'])).toBeUndefined()
  })

  it('session expirée pendant l’utilisation : retour à l’état anonyme', () => {
    const { store } = setup()
    setAccessToken('token')

    store.dispatch(sessionExpired())

    expect(store.getState().auth.status).toBe('anonymous')
    expect(getAccessToken()).toBeNull()
  })
})
