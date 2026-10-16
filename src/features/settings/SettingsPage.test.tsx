import { screen, waitFor, within } from '@testing-library/react'
import { http as mock, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { meResponse } from '../../test/fixtures'
import { renderApp } from '../../test/render'
import { server } from '../../test/server'
import type { Company, PaymentMethod, Shop } from '../../types/settings'

const company: Company = {
  id: 'company-1',
  name: 'Commerce 1',
  slug: 'commerce-1',
  currency: 'XOF',
  timezone: 'Africa/Abidjan',
  status: 'active',
  settings: { maxCashierDiscountPercent: 10 },
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
}

const shop = (id: string, name: string, code: string, archivedAt: string | null = null): Shop => ({
  id,
  name,
  code,
  address: null,
  phone: null,
  archivedAt,
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
})

/** Fausse API avec état pour les paramètres (boutiques, moyens de paiement, entreprise). */
function useSettingsApi() {
  const db = {
    company: { ...company },
    shops: [shop('s1', 'Boutique Centre', 'BTQ1'), shop('s2', 'Ancien dépôt', 'DEP', '2026-09-01T10:00:00.000Z')],
    methods: [
      { id: 'pm1', code: 'cash', name: 'Espèces', type: 'cash', active: true, sortOrder: 1 },
      { id: 'pm2', code: 'mobile_money', name: 'Mobile Money', type: 'mobile_money', active: true, sortOrder: 2 },
    ] as PaymentMethod[],
    requests: [] as { method: string; path: string; body: unknown }[],
  }
  const record = async (request: Request) => {
    db.requests.push({ method: request.method, path: new URL(request.url).pathname, body: await request.clone().json().catch(() => null) })
  }
  server.use(
    mock.get('/api/company', () => HttpResponse.json({ company: db.company })),
    mock.patch('/api/company', async ({ request }) => {
      await record(request)
      const body = (await request.json()) as Partial<Company>
      db.company = { ...db.company, ...body, settings: { ...db.company.settings, ...body.settings }, updatedAt: new Date().toISOString() }
      return HttpResponse.json({ company: db.company })
    }),
    mock.get('/api/shops', ({ request }) => {
      const withArchived = new URL(request.url).searchParams.get('includeArchived') === 'true'
      return HttpResponse.json({ shops: withArchived ? db.shops : db.shops.filter((item) => !item.archivedAt) })
    }),
    mock.post('/api/shops', async ({ request }) => {
      await record(request)
      const body = (await request.json()) as Shop
      if (db.shops.some((item) => item.code === body.code)) {
        return HttpResponse.json({ error: { message: 'Une boutique utilise déjà ce code' } }, { status: 409 })
      }
      const created = shop(`s${db.shops.length + 1}`, body.name, body.code)
      db.shops.push(created)
      return HttpResponse.json({ shop: created }, { status: 201 })
    }),
    mock.patch('/api/shops/:id', async ({ request, params }) => {
      await record(request)
      const body = (await request.json()) as { archived?: boolean }
      db.shops = db.shops.map((item) =>
        item.id === params.id ? { ...item, archivedAt: body.archived ? '2026-10-16T10:00:00.000Z' : null } : item,
      )
      return HttpResponse.json({ shop: db.shops.find((item) => item.id === params.id) })
    }),
    mock.get('/api/payment-methods', () => HttpResponse.json({ paymentMethods: db.methods })),
    mock.post('/api/payment-methods', async ({ request }) => {
      await record(request)
      const created = { id: 'pm3', active: true, ...((await request.json()) as Omit<PaymentMethod, 'id' | 'active'>) }
      db.methods.push(created)
      return HttpResponse.json({ paymentMethod: created }, { status: 201 })
    }),
    mock.patch('/api/payment-methods/:id', async ({ request, params }) => {
      await record(request)
      const body = (await request.json()) as Partial<PaymentMethod>
      db.methods = db.methods.map((item) => (item.id === params.id ? { ...item, ...body } : item))
      return HttpResponse.json({ paymentMethod: db.methods.find((item) => item.id === params.id) })
    }),
  )
  return db
}

describe('Paramètres : entreprise', () => {
  it('modifie le nom et la remise maximale ; le nom de l’en-tête suit', async () => {
    const db = useSettingsApi()
    let meCalls = 0
    server.use(
      mock.get('/api/auth/me', () => {
        meCalls += 1
        return HttpResponse.json({ ...meResponse(), activeCompany: { ...meResponse().activeCompany!, name: 'Commerce Diop' } })
      }),
    )
    const { user } = renderApp('/settings')

    const name = await screen.findByLabelText('Nom de l’entreprise')
    expect(screen.getByDisplayValue('FCFA (XOF)')).toBeDisabled()
    await user.clear(name)
    await user.type(name, 'Commerce Diop')
    const discount = screen.getByLabelText('Remise maximale d’un caissier')
    await user.clear(discount)
    await user.type(discount, '15')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Paramètres de l’entreprise enregistrés')).toBeInTheDocument()
    expect(db.requests.at(-1)).toEqual({
      method: 'PATCH',
      path: '/api/company',
      body: { name: 'Commerce Diop', timezone: 'Africa/Abidjan', settings: { maxCashierDiscountPercent: 15 } },
    })
    // La session est relue : l'en-tête affiche le nouveau nom
    await waitFor(() => expect(meCalls).toBe(1))
    expect(await screen.findByText('Commerce Diop', { selector: 'span' })).toBeInTheDocument()
  })
})

describe('Paramètres : boutiques', () => {
  it('cache les boutiques archivées par défaut, et les montre à la demande', async () => {
    useSettingsApi()
    const { user } = renderApp('/settings?onglet=shops')

    expect(await screen.findByText('Boutique Centre', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.queryByText('Ancien dépôt')).not.toBeInTheDocument()

    await user.click(screen.getByRole('switch', { name: 'Afficher les boutiques archivées' }))
    expect(await screen.findByText('Ancien dépôt')).toBeInTheDocument()
    expect(screen.getByText(/Archivée le/)).toBeInTheDocument()
  })

  it('crée une boutique (code mis en majuscules) et affiche le refus du serveur', async () => {
    const db = useSettingsApi()
    const { user } = renderApp('/settings?onglet=shops')

    await user.click(await screen.findByRole('button', { name: /Nouvelle boutique/ }))
    let dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Nom'), 'Boutique Marché')
    await user.type(within(dialog).getByLabelText('Code'), 'btq2')
    await user.click(within(dialog).getByRole('button', { name: 'Créer la boutique' }))

    expect(await screen.findByText('Boutique « Boutique Marché » créée')).toBeInTheDocument()
    expect(db.requests.at(-1)).toMatchObject({ method: 'POST', body: { name: 'Boutique Marché', code: 'BTQ2' } })
    expect(await screen.findByText('Boutique Marché', { selector: 'strong' })).toBeInTheDocument()

    // Même code une seconde fois : message du serveur dans la fenêtre
    await user.click(screen.getByRole('button', { name: /Nouvelle boutique/ }))
    dialog = await screen.findByRole('dialog')
    // Nouveau formulaire vide (et non les valeurs de la boutique précédente)
    expect(within(dialog).getByLabelText('Nom')).toHaveValue('')
    await user.type(within(dialog).getByLabelText('Nom'), 'Doublon')
    await user.type(within(dialog).getByLabelText('Code'), 'BTQ2')
    await user.click(within(dialog).getByRole('button', { name: 'Créer la boutique' }))
    expect(await within(dialog).findByText('Une boutique utilise déjà ce code')).toBeInTheDocument()
  })

  it('archive une boutique après confirmation', async () => {
    const db = useSettingsApi()
    const { user } = renderApp('/settings?onglet=shops')

    await user.click(await screen.findByRole('button', { name: 'Archiver Boutique Centre' }))
    await user.click(await screen.findByRole('button', { name: 'Archiver' }))

    expect(await screen.findByText('Boutique Centre archivée')).toBeInTheDocument()
    expect(db.requests.at(-1)).toEqual({ method: 'PATCH', path: '/api/shops/s1', body: { archived: true } })
  })
})

describe('Paramètres : moyens de paiement', () => {
  it('désactive un moyen de paiement et en ajoute un nouveau', async () => {
    const db = useSettingsApi()
    const { user } = renderApp('/settings?onglet=payment-methods')

    await user.click(await screen.findByRole('switch', { name: 'Mobile Money actif en caisse' }))
    expect(await screen.findByText('Mobile Money désactivé')).toBeInTheDocument()
    expect(db.requests.at(-1)).toEqual({ method: 'PATCH', path: '/api/payment-methods/pm2', body: { active: false } })

    await user.click(screen.getByRole('button', { name: /Nouveau moyen de paiement/ }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Nom affiché en caisse'), 'Wave')
    await user.type(within(dialog).getByLabelText('Code interne'), 'WAVE')
    await user.click(within(dialog).getByRole('button', { name: 'Ajouter' }))

    expect(await screen.findByText('« Wave » ajouté')).toBeInTheDocument()
    expect(db.requests.at(-1)).toMatchObject({ method: 'POST', body: { name: 'Wave', code: 'wave', type: 'mobile_money', sortOrder: 10 } })
  })
})

describe('Paramètres : accès', () => {
  it('réservés à company.manage : ni menu, ni page', async () => {
    useSettingsApi()
    const { router } = renderApp('/settings', { session: meResponse({ permissions: ['users.manage'] }) })

    const menu = await screen.findByRole('menu')
    expect(within(menu).queryByText('Paramètres')).not.toBeInTheDocument()
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })
})
