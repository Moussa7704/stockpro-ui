import { screen, waitFor, within } from '@testing-library/react'
import { http as mock, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { meResponse, shopsFixture } from '../../test/fixtures'
import { mockPlatformApi, platformAdmin } from '../../test/platformApi'
import { renderApp } from '../../test/render'
import { server } from '../../test/server'

const companiesTable = async () => {
  await screen.findByText('Épicerie du Centre')
  return screen.getByRole('table')
}

describe('Accès au back-office', () => {
  it('un commerçant (même propriétaire) n’y accède pas : retour à l’accueil', async () => {
    server.use(mock.get('/api/shops', () => HttpResponse.json({ shops: shopsFixture })))
    const { router } = renderApp('/platform', { session: meResponse() })

    expect(await screen.findByRole('heading', { name: 'Bonjour Awa Diop' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('super-admin membre d’une entreprise : lien dans le menu utilisateur, et retour vers son entreprise', async () => {
    server.use(mock.get('/api/shops', () => HttpResponse.json({ shops: shopsFixture })))
    mockPlatformApi()
    const { user, router } = renderApp('/', { session: platformAdmin() })

    await user.click(await screen.findByRole('button', { name: 'Menu utilisateur' }))
    await user.click(await screen.findByText('Back-office plateforme'))
    expect(await screen.findByRole('heading', { name: 'Commerçants' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/platform')
    expect(screen.getByRole('link', { name: /Mon entreprise/ })).toHaveAttribute('href', '/')
  })

  it('super-admin sans entreprise : arrive directement dans le back-office', async () => {
    mockPlatformApi()
    const { router } = renderApp('/', { session: platformAdmin({ companies: 0 }) })

    expect(await screen.findByRole('heading', { name: 'Commerçants' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/platform')
    expect(screen.queryByRole('link', { name: /Mon entreprise/ })).not.toBeInTheDocument()
  })
})

describe('Liste des commerçants', () => {
  it('statut en toutes lettres, recherche sans accents, filtre par statut', async () => {
    mockPlatformApi()
    const { user } = renderApp('/platform', { session: platformAdmin() })

    const table = await companiesTable()
    expect(screen.getByText('3 commerçant(s) · 1 suspendu(s)')).toBeInTheDocument()
    const closed = within(table).getByText('Boutique Fermée').closest('tr')!
    expect(within(closed).getByText('Suspendu')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Rechercher un commerçant'), 'epicerie')
    expect(within(table).getByText('Épicerie du Centre')).toBeInTheDocument()
    expect(within(table).queryByText('Quincaillerie Traoré')).not.toBeInTheDocument()

    await user.clear(screen.getByLabelText('Rechercher un commerçant'))
    await user.click(screen.getByText('Suspendus'))
    expect(within(table).getByText('Boutique Fermée')).toBeInTheDocument()
    expect(within(table).queryByText('Épicerie du Centre')).not.toBeInTheDocument()
  })

  it('créer un commerçant : données envoyées, invitation annoncée, ouverture de sa fiche', async () => {
    const db = mockPlatformApi()
    const { user, router } = renderApp('/platform', { session: platformAdmin() })
    await companiesTable()

    await user.click(screen.getByRole('button', { name: /Nouveau commerçant/ }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Nom de l’entreprise'), 'Pharmacie Awa')
    await user.type(within(dialog).getByLabelText('Nom du propriétaire'), 'Awa Ndiaye')
    await user.type(within(dialog).getByLabelText('Email du propriétaire'), 'awa.ndiaye@test.com')
    await user.click(within(dialog).getByRole('button', { name: 'Créer et inviter' }))

    expect(await screen.findByText('Commerçant créé. Invitation envoyée à awa.ndiaye@test.com.')).toBeInTheDocument()
    expect(db.requests.at(-1)).toEqual({
      method: 'POST',
      path: '/api/platform/companies',
      body: { name: 'Pharmacie Awa', timezone: 'Africa/Abidjan', shopName: 'Boutique principale', owner: { name: 'Awa Ndiaye', email: 'awa.ndiaye@test.com' } },
    })
    await waitFor(() => expect(router.state.location.pathname).toBe('/platform/companies/c-new'))
    expect(await screen.findByRole('heading', { name: 'Pharmacie Awa' })).toBeInTheDocument()
  })

  it('formulaire de création : email et identifiant vérifiés avant l’envoi', async () => {
    const db = mockPlatformApi()
    const { user } = renderApp('/platform', { session: platformAdmin() })
    await companiesTable()

    await user.click(screen.getByRole('button', { name: /Nouveau commerçant/ }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Nom de l’entreprise'), 'Pharmacie Awa')
    await user.type(within(dialog).getByLabelText('Nom du propriétaire'), 'Awa Ndiaye')
    await user.type(within(dialog).getByLabelText('Email du propriétaire'), 'pas-un-email')
    await user.click(within(dialog).getByText('Options avancées'))
    await user.type(await within(dialog).findByLabelText('Identifiant'), 'Pharmacie Awa')
    await user.click(within(dialog).getByRole('button', { name: 'Créer et inviter' }))

    expect(await within(dialog).findByText('Email invalide')).toBeInTheDocument()
    expect(within(dialog).getByText('Lettres minuscules, chiffres et tirets uniquement')).toBeInTheDocument()
    expect(db.requests).toHaveLength(0)
  })
})

describe('Fiche d’un commerçant', () => {
  it('propriétaire en attente : renvoyer l’invitation', async () => {
    const db = mockPlatformApi()
    const { user } = renderApp('/platform/companies/c2', { session: platformAdmin() })

    const owner = (await screen.findByText('Propriétaire', { selector: '.ant-card-head-title' })).closest('.ant-card') as HTMLElement
    expect(within(owner).getByText('moussa@test.com')).toBeInTheDocument()
    expect(within(owner).getByText('Invitation en attente')).toBeInTheDocument()

    await user.click(within(owner).getByRole('button', { name: /Renvoyer l’invitation/ }))

    expect(await screen.findByText('Nouvelle invitation envoyée à moussa@test.com. L’ancien lien ne fonctionne plus.')).toBeInTheDocument()
    expect(db.requests.at(-1)).toMatchObject({ method: 'POST', path: '/api/platform/companies/c2/owner/invitation' })
  })

  it('compte activé : pas de bouton de renvoi ; boutiques et membres listés', async () => {
    mockPlatformApi()
    renderApp('/platform/companies/c1', { session: platformAdmin() })

    expect(await screen.findByRole('heading', { name: 'Épicerie du Centre' })).toBeInTheDocument()
    expect(screen.getAllByText('Compte activé').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByRole('button', { name: /Renvoyer l’invitation/ })).not.toBeInTheDocument()
    expect(screen.getByText('Boutiques (1)')).toBeInTheDocument()
    expect(screen.getByText('Membres (1)')).toBeInTheDocument()
  })

  it('suspendre après confirmation, puis réactiver', async () => {
    const db = mockPlatformApi()
    const { user } = renderApp('/platform/companies/c1', { session: platformAdmin() })
    await screen.findByRole('heading', { name: 'Épicerie du Centre' })

    await user.click(screen.getByRole('button', { name: /Suspendre/ }))
    expect(await screen.findByText(/Ses membres perdent l’accès immédiatement/)).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Suspendre' }).at(-1)!)

    expect(await screen.findByText('Commerçant suspendu : ses membres n’ont plus accès')).toBeInTheDocument()
    expect(db.requests.at(-1)).toEqual({ method: 'PATCH', path: '/api/platform/companies/c1', body: { status: 'suspended' } })
    expect(await screen.findByText('Commerçant suspendu')).toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: /Réactiver/ }))
    await waitFor(() => expect(db.requests.at(-1)?.body).toEqual({ status: 'active' }))
    expect(await screen.findByRole('button', { name: /Suspendre/ })).toBeInTheDocument()
  })

  it('renommer', async () => {
    const db = mockPlatformApi()
    const { user } = renderApp('/platform/companies/c1', { session: platformAdmin() })
    await screen.findByRole('heading', { name: 'Épicerie du Centre' })

    await user.click(screen.getByRole('button', { name: /Renommer/ }))
    const dialog = await screen.findByRole('dialog')
    const name = within(dialog).getByLabelText('Nom de l’entreprise')
    await user.clear(name)
    await user.type(name, 'Épicerie Centrale')
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByRole('heading', { name: 'Épicerie Centrale' })).toBeInTheDocument()
    expect(db.requests.at(-1)).toEqual({ method: 'PATCH', path: '/api/platform/companies/c1', body: { name: 'Épicerie Centrale' } })
  })
})
