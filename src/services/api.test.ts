import { http as mock, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { server } from '../test/server'
import { api, ApiError, getAccessToken, getErrorMessage, newIdempotencyKey, setAccessToken, setSessionExpiredHandler } from './api'

describe('api() : appels à l’API', () => {
  it('envoie le token, les paramètres d’URL et renvoie les données', async () => {
    setAccessToken('token-1')
    let seen: { auth: string | null; search: string } | null = null
    server.use(
      mock.get('/api/products', ({ request }) => {
        seen = { auth: request.headers.get('Authorization'), search: new URL(request.url).search }
        return HttpResponse.json({ items: [1, 2] })
      }),
    )

    const data = await api<{ items: number[] }>('/products', { params: { search: 'riz', page: 2, shopId: undefined } })

    expect(data).toEqual({ items: [1, 2] })
    expect(seen).toEqual({ auth: 'Bearer token-1', search: '?search=riz&page=2' })
  })

  it('204 : renvoie undefined', async () => {
    server.use(mock.delete('/api/roles/r1', () => new HttpResponse(null, { status: 204 })))
    await expect(api('/roles/r1', { method: 'DELETE' })).resolves.toBeUndefined()
  })

  it('ajoute la clé d’idempotence quand on la fournit', async () => {
    let key: string | null = null
    server.use(
      mock.post('/api/pos/sales', ({ request }) => {
        key = request.headers.get('Idempotency-Key')
        return HttpResponse.json({ sale: {} }, { status: 201 })
      }),
    )
    const idempotencyKey = newIdempotencyKey()

    await api('/pos/sales', { method: 'POST', body: {}, idempotencyKey })

    expect(key).toBe(idempotencyKey)
    expect(idempotencyKey).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe('api() : erreurs', () => {
  it('remonte le message du serveur, en français, avec ses détails', async () => {
    server.use(
      mock.post('/api/members', () =>
        HttpResponse.json({ error: { message: 'Données invalides', details: [{ field: 'email', message: 'Email invalide' }] } }, { status: 400 }),
      ),
    )

    const error = await api('/members', { method: 'POST', body: {} }).catch((err: unknown) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 400, message: 'Données invalides', details: [{ field: 'email', message: 'Email invalide' }] })
    expect(getErrorMessage(error)).toBe('Données invalides')
  })

  it('serveur injoignable : statut 0 et message clair', async () => {
    server.use(mock.get('/api/shops', () => HttpResponse.error()))

    const error = await api('/shops').catch((err: unknown) => err)

    expect(error).toMatchObject({ status: 0, message: 'Impossible de joindre le serveur.' })
  })
})

describe('api() : renouvellement de la session', () => {
  it('token expiré : un seul /refresh partagé, puis les requêtes sont rejouées', async () => {
    setAccessToken('expired')
    let refreshCalls = 0
    server.use(
      mock.post('/api/auth/refresh', () => {
        refreshCalls += 1
        return HttpResponse.json({ accessToken: 'fresh' })
      }),
      mock.get('/api/members', ({ request }) =>
        request.headers.get('Authorization') === 'Bearer fresh'
          ? HttpResponse.json({ members: [] })
          : HttpResponse.json({ error: { message: 'Token invalide ou expiré' } }, { status: 401 }),
      ),
    )

    const results = await Promise.all([api('/members'), api('/members'), api('/members')])

    expect(results).toEqual([{ members: [] }, { members: [] }, { members: [] }])
    // Le serveur fait tourner le refresh token : deux /refresh simultanés couperaient la session
    expect(refreshCalls).toBe(1)
    expect(getAccessToken()).toBe('fresh')
  })

  it('refresh refusé : session expirée signalée, erreur 401 remontée', async () => {
    setAccessToken('expired')
    const expired = vi.fn()
    setSessionExpiredHandler(expired)
    server.use(
      mock.post('/api/auth/refresh', () => HttpResponse.json({ error: { message: 'Session expirée' } }, { status: 401 })),
      mock.get('/api/members', () => HttpResponse.json({ error: { message: 'Token invalide ou expiré' } }, { status: 401 })),
    )

    await expect(api('/members')).rejects.toMatchObject({ status: 401 })
    expect(expired).toHaveBeenCalledOnce()
    expect(getAccessToken()).toBeNull()
  })

  it('sans token envoyé (ex. mauvais mot de passe) : pas de refresh, l’erreur est rendue telle quelle', async () => {
    const refresh = vi.fn()
    server.use(
      mock.post('/api/auth/refresh', () => {
        refresh()
        return HttpResponse.json({ accessToken: 'x' })
      }),
      mock.post('/api/auth/login', () => HttpResponse.json({ error: { message: 'Email ou mot de passe incorrect' } }, { status: 401 })),
    )

    await expect(api('/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({ message: 'Email ou mot de passe incorrect' })
    expect(refresh).not.toHaveBeenCalled()
  })
})
