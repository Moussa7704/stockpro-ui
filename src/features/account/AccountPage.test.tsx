import { screen, waitFor, within } from '@testing-library/react'
import { http as mock, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { meResponse } from '../../test/fixtures'
import { renderApp } from '../../test/render'
import { server } from '../../test/server'
import type { AccountSession } from '../../types/auth'

const PHONE = 'Mozilla/5.0 (Linux; Android 14; SM-A146B) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36'
const PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0 Safari/537.36'
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Safari/604.1'

const session = (id: string, userAgent: string, current = false): AccountSession => ({
  id,
  userAgent,
  ipAddress: '196.207.10.4',
  startedAt: '2026-10-15T08:00:00.000Z',
  lastActiveAt: '2026-10-17T16:30:00.000Z',
  expiresAt: '2026-10-24T08:00:00.000Z',
  current,
})

/** Fausse API des appareils connectés (avec état). */
function mockSessionsApi() {
  const db = {
    sessions: [session('s-pc', PC, true), session('s-phone', PHONE), session('s-tablet', IPAD)],
    requests: [] as string[],
  }
  server.use(
    mock.get('/api/auth/sessions', () => HttpResponse.json({ sessions: db.sessions })),
    mock.delete('/api/auth/sessions/:id', ({ params }) => {
      db.requests.push(`DELETE ${String(params.id)}`)
      db.sessions = db.sessions.filter((item) => item.id !== params.id)
      return new HttpResponse(null, { status: 204 })
    }),
    mock.post('/api/auth/sessions/revoke-others', () => {
      db.requests.push('POST revoke-others')
      const revoked = db.sessions.filter((item) => !item.current).length
      db.sessions = db.sessions.filter((item) => item.current)
      return HttpResponse.json({ revoked })
    }),
  )
  return db
}

const devicesCard = async () => (await screen.findByText('Appareils connectés', { selector: '.ant-card-head-title' })).closest('.ant-card') as HTMLElement

describe('Mon compte : appareils connectés', () => {
  it('liste les appareils en clair, celui-ci signalé et sans bouton de déconnexion', async () => {
    mockSessionsApi()
    renderApp('/account', { session: meResponse() })

    const card = await devicesCard()
    const current = (await within(card).findByText('Cet appareil')).closest('li')!
    expect(within(current).getByText('Chrome sur Windows')).toBeInTheDocument()
    expect(within(current).queryByRole('button', { name: /Déconnecter/ })).not.toBeInTheDocument()
    expect(within(card).getByText('Chrome sur Android')).toBeInTheDocument()
    expect(within(card).getByText('Safari sur iOS')).toBeInTheDocument()
    expect(within(card).getAllByText(/adresse 196\.207\.10\.4/)).toHaveLength(3)
  })

  it('déconnecter un appareil après confirmation', async () => {
    const db = mockSessionsApi()
    const { user } = renderApp('/account', { session: meResponse() })
    const card = await devicesCard()

    await user.click(await within(card).findByRole('button', { name: 'Déconnecter Chrome sur Android' }))
    await user.click(await screen.findByRole('button', { name: 'Déconnecter' }))

    expect(await screen.findByText('Chrome sur Android est déconnecté')).toBeInTheDocument()
    expect(db.requests).toEqual(['DELETE s-phone'])
    await waitFor(() => expect(within(card).queryByText('Chrome sur Android')).not.toBeInTheDocument())
  })

  it('déconnecter tous les autres appareils', async () => {
    const db = mockSessionsApi()
    const { user } = renderApp('/account', { session: meResponse() })
    const card = await devicesCard()

    await user.click(await within(card).findByRole('button', { name: 'Déconnecter tous les autres' }))
    expect(await screen.findByText(/Il faudra se reconnecter sur chacun/)).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Déconnecter' }).at(-1)!)

    expect(await screen.findByText('2 autre(s) appareil(s) déconnecté(s)')).toBeInTheDocument()
    expect(db.requests).toEqual(['POST revoke-others'])
    // Plus d'autre appareil : le bouton disparaît
    await waitFor(() => expect(within(card).queryByRole('button', { name: 'Déconnecter tous les autres' })).not.toBeInTheDocument())
  })

  it('changer de mot de passe met la liste à jour (les autres appareils sont déconnectés)', async () => {
    const db = mockSessionsApi()
    server.use(
      mock.post('/api/auth/password/change', () => {
        db.sessions = db.sessions.filter((item) => item.current)
        return HttpResponse.json({ message: 'Mot de passe modifié, vos autres appareils ont été déconnectés' })
      }),
    )
    const { user } = renderApp('/account', { session: meResponse() })
    const card = await devicesCard()
    await within(card).findByText('Chrome sur Android')

    await user.type(screen.getByLabelText('Mot de passe actuel'), 'AncienMotDePasse!1')
    await user.type(screen.getByLabelText('Nouveau mot de passe'), 'NouveauMotDePasse!2026')
    await user.type(screen.getByLabelText('Confirmer le nouveau mot de passe'), 'NouveauMotDePasse!2026')
    await user.click(screen.getByRole('button', { name: /Changer|Enregistrer/ }))

    expect(await screen.findByText('Mot de passe modifié, vos autres appareils ont été déconnectés')).toBeInTheDocument()
    await waitFor(() => expect(within(card).queryByText('Chrome sur Android')).not.toBeInTheDocument())
  })
})
