import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { meResponse } from '../../test/fixtures'
import { cashMethod, mockPosApi, seedSale } from '../../test/posApi'
import { renderApp } from '../../test/render'
import { mockStockApi } from '../../test/stockApi'
import { createAppStore } from '../../store'
import { sessionCleared } from '../../store/authSlice'
import { cartCleared, productAdded } from '../../store/posSlice'

const cashier = meResponse({ permissions: ['sales.create', 'cash_sessions.manage', 'customers.manage', 'products.view'], roleCode: 'cashier' })
const manager = meResponse({ permissions: ['sales.create', 'sales.discount', 'sales.cancel_refund', 'cash_sessions.manage', 'customers.manage', 'products.view'] })

function setup(options?: Parameters<typeof mockPosApi>[0]) {
  mockStockApi()
  return mockPosApi(options)
}

/** Scanne un code-barres dans le champ produit de la caisse. */
async function scan(user: ReturnType<typeof renderApp>['user'], code: string) {
  await user.type(await screen.findByLabelText('Ajouter un produit'), `${code}{Enter}`)
}

describe('Caisse : session', () => {
  it('caisse fermée : on l’ouvre avec le fond de caisse', async () => {
    const { requestsTo } = setup({ sessionOpen: false })
    const { user } = renderApp('/pos', { session: cashier })

    await user.type(await screen.findByLabelText('Fond de caisse'), '10000')
    await user.click(screen.getByRole('button', { name: 'Ouvrir la caisse' }))

    expect(await screen.findByText('Caisse ouverte : bonnes ventes !')).toBeInTheDocument()
    expect(requestsTo('POST', '/api/pos/sessions')[0]?.body).toEqual({ shopId: 'shop-1', openingFloat: '10000' })
    expect(await screen.findByLabelText('Ajouter un produit')).toBeInTheDocument()
  })

  it('clôture : espèces attendues et écart affiché avant de valider', async () => {
    const { requestsTo } = setup()
    const { user } = renderApp('/pos', { session: cashier })

    await user.click(await screen.findByRole('button', { name: /Clôturer la caisse/ }))
    const modal = await screen.findByRole('dialog')
    expect(await within(modal).findByText('Espèces attendues')).toBeInTheDocument()
    await user.type(within(modal).getByLabelText('Espèces comptées'), '9500')
    expect(await within(modal).findByText('Il manque de l’argent')).toBeInTheDocument()
    await user.click(within(modal).getByRole('button', { name: 'Clôturer' }))

    expect(await screen.findByText(/Caisse clôturée avec un écart/)).toBeInTheDocument()
    expect(requestsTo('POST', '/api/pos/sessions/cs-1/close')[0]?.body).toMatchObject({ countedCash: '9500' })
  })
})

describe('Caisse : vente', () => {
  it('scan ×2, encaissement en espèces avec monnaie rendue, ticket, panier vidé', async () => {
    const { requestsTo } = setup()
    const { user, store } = renderApp('/pos', { session: cashier })

    await scan(user, '6001234567890')
    await scan(user, '6001234567890')
    await waitFor(() => expect(screen.getByLabelText('Quantité de Riz parfumé 25 kg')).toHaveValue('2'))
    expect(screen.getAllByText('3 000 FCFA').length).toBeGreaterThan(0)

    // F9 : encaisser
    await user.keyboard('{F9}')
    const modal = await screen.findByRole('dialog')
    // Nom accessible avec espaces insécables : la recherche par rôle ne les normalise pas
    await user.click(within(modal).getByRole('button', { name: /^5\s000\sFCFA$/ }))
    expect(within(modal).getByText('Monnaie à rendre')).toBeInTheDocument()
    expect(within(modal).getByText('2 000 FCFA')).toBeInTheDocument()
    await user.click(within(modal).getByRole('button', { name: 'Valider la vente' }))

    expect(await screen.findByText(/Monnaie à rendre/)).toBeInTheDocument()
    expect(await screen.findByText(/Ticket BTQ1-T-2026-000001/, { selector: 'pre' })).toBeInTheDocument()
    const sent = requestsTo('POST', '/api/pos/sales')[0]!
    expect(sent.body).toEqual({
      shopId: 'shop-1',
      customerId: null,
      lines: [{ productId: 'p-rice', quantity: '2' }],
      payments: [{ methodId: cashMethod.id, amount: '5000' }],
      notes: null,
    })
    expect(sent.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/)
    expect(store.getState().pos.lines).toEqual([])
    expect(store.getState().pos.idempotencyKey).not.toBe(sent.idempotencyKey)
  })

  it('connexion perdue : panier gardé, nouvel essai avec la MÊME clé, une seule vente', async () => {
    const { db, requestsTo } = setup({ failFirstSale: true })
    const { user } = renderApp('/pos', { session: cashier })

    await scan(user, 'RIZ-25')
    await user.click(await screen.findByRole('button', { name: /Encaisser/ }))
    const modal = await screen.findByRole('dialog')
    await user.click(within(modal).getByRole('button', { name: 'Valider la vente' }))
    expect(await within(modal).findByText(/Vente non confirmée \(connexion perdue\)/)).toBeInTheDocument()
    expect(screen.getByLabelText('Quantité de Riz parfumé 25 kg')).toBeInTheDocument()

    await user.click(within(modal).getByRole('button', { name: 'Valider la vente' }))
    expect(await screen.findByText(/Ticket BTQ1-T-2026-000001/, { selector: 'pre' })).toBeInTheDocument()

    const attempts = requestsTo('POST', '/api/pos/sales')
    expect(attempts).toHaveLength(2)
    expect(attempts[0]!.idempotencyKey).toBe(attempts[1]!.idempotencyKey)
    expect(db.sales).toHaveLength(1)
  })

  it('paiement incomplet : refusé sans client, accepté à crédit pour un client', async () => {
    const { requestsTo } = setup()
    const { user } = renderApp('/pos', { session: cashier })

    await scan(user, 'RIZ-25')
    await user.click(await screen.findByRole('button', { name: /Encaisser/ }))
    let modal = await screen.findByRole('dialog')
    const amount = within(modal).getByLabelText('Montant 1')
    await user.clear(amount)
    await user.type(amount, '500')
    expect(within(modal).getByText('Paiement incomplet : choisissez un client pour une vente à crédit')).toBeInTheDocument()
    expect(within(modal).getByRole('button', { name: 'Valider la vente' })).toBeDisabled()
    await user.click(within(modal).getByRole('button', { name: 'Retour au panier' }))

    await user.type(screen.getByLabelText('Client'), 'Awa')
    await user.click(await screen.findByText(/Awa Ndiaye/))
    await user.click(screen.getByRole('button', { name: /Encaisser/ }))
    modal = await screen.findByRole('dialog')
    const second = within(modal).getByLabelText('Montant 1')
    await user.clear(second)
    await user.type(second, '500')
    expect(within(modal).getByText(/Reste dû/)).toBeInTheDocument()
    await user.click(within(modal).getByRole('button', { name: 'Valider la vente' }))

    await screen.findByText(/Ticket BTQ1-T-2026-000001/, { selector: 'pre' })
    expect(requestsTo('POST', '/api/pos/sales')[0]?.body).toMatchObject({ customerId: 'cu-1', payments: [{ amount: '500' }] })
  })

  it('remise au-delà du plafond du caissier : encaissement bloqué', async () => {
    setup({ maxCashierDiscountPercent: 10 })
    const { user } = renderApp('/pos', { session: cashier })

    await scan(user, 'RIZ-25')
    await user.click(await screen.findByRole('button', { name: 'Remise sur le ticket' }))
    await user.type(await screen.findByLabelText('Valeur de la remise'), '15')
    await user.click(screen.getByRole('button', { name: 'Appliquer' }))

    expect(await screen.findByText(/au-delà de 10 %, l’accord d’un gérant est nécessaire/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Encaisser/ })).toBeDisabled()
  })
})

describe('Caisse : son de vente', () => {
  // jsdom ne joue pas de son : on vérifie seulement que la lecture est demandée
  const playSpy = () => vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  afterEach(() => vi.restoreAllMocks())

  async function sell(user: ReturnType<typeof renderApp>['user']) {
    await scan(user, 'RIZ-25')
    await user.click(await screen.findByRole('button', { name: /Encaisser/ }))
    const modal = await screen.findByRole('dialog')
    await user.click(within(modal).getByRole('button', { name: 'Valider la vente' }))
    return modal
  }

  it('le son des pièces part quand le serveur confirme la vente, jamais pour une vente non confirmée', async () => {
    const play = playSpy()
    setup({ failFirstSale: true })
    const { user } = renderApp('/pos', { session: cashier })

    const modal = await sell(user)
    expect(await within(modal).findByText(/Vente non confirmée/)).toBeInTheDocument()
    expect(play).not.toHaveBeenCalled()

    await user.click(within(modal).getByRole('button', { name: 'Valider la vente' }))
    expect(await screen.findByText(/Ticket BTQ1-T-2026-000001/, { selector: 'pre' })).toBeInTheDocument()
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('son coupé sur cet appareil : aucune lecture, et le réglage est gardé', async () => {
    const play = playSpy()
    setup()
    const { user } = renderApp('/pos', { session: cashier })

    const toggle = await screen.findByRole('button', { name: 'Son des ventes' })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(localStorage.getItem('stockpro:pos-sale-sound')).toBe('off')

    await sell(user)
    expect(await screen.findByText(/Ticket BTQ1-T-2026-000001/, { selector: 'pre' })).toBeInTheDocument()
    expect(play).not.toHaveBeenCalled()
  })
})

describe('Panier (Redux Toolkit)', () => {
  it('sauvegardé avec sa clé dans le navigateur, nouvelle clé après la vente, vidé à la déconnexion', () => {
    const store = createAppStore()
    store.dispatch(productAdded({ productId: 'p-rice', sku: 'RIZ-25', name: 'Riz', unitSymbol: 'pce', allowsDecimal: false, catalogPrice: '1500.00' }))
    const key = store.getState().pos.idempotencyKey

    // Rechargement de la page : même panier, même clé
    const reloaded = createAppStore()
    expect(reloaded.getState().pos.lines).toHaveLength(1)
    expect(reloaded.getState().pos.idempotencyKey).toBe(key)

    reloaded.dispatch(cartCleared())
    expect(reloaded.getState().pos.idempotencyKey).not.toBe(key)

    reloaded.dispatch(productAdded({ productId: 'p-rice', sku: 'RIZ-25', name: 'Riz', unitSymbol: 'pce', allowsDecimal: false, catalogPrice: '1500.00' }))
    reloaded.dispatch(sessionCleared())
    expect(reloaded.getState().pos.lines).toEqual([])
  })
})

describe('Historique de caisse', () => {
  it('annule une vente avec un motif (clé d’idempotence)', async () => {
    const { db, requestsTo } = setup()
    seedSale(db)
    const { user } = renderApp('/pos/sales', { session: manager })

    await user.click(await screen.findByRole('button', { name: 'Ouvrir BTQ1-T-2026-000042' }))
    await user.click(await screen.findByRole('button', { name: 'Annuler la vente' }))
    const modal = (await screen.findAllByRole('dialog')).at(-1)!
    await user.type(within(modal).getByLabelText('Motif de l’annulation'), 'Erreur de saisie')
    await user.click(within(modal).getByRole('button', { name: 'Annuler la vente' }))

    expect(await screen.findByText('Vente BTQ1-T-2026-000042 annulée')).toBeInTheDocument()
    const sent = requestsTo('POST', '/api/pos/sales/sale-seed/cancel')[0]!
    expect(sent.body).toEqual({ reason: 'Erreur de saisie' })
    expect(sent.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('retour client : jamais plus que vendu, remboursement en espèces', async () => {
    const { db, requestsTo } = setup()
    seedSale(db)
    const { user } = renderApp('/pos/sales', { session: manager })

    await user.click(await screen.findByRole('button', { name: 'Ouvrir BTQ1-T-2026-000042' }))
    await user.click(await screen.findByRole('button', { name: 'Retour client' }))
    const modal = (await screen.findAllByRole('dialog')).at(-1)!
    await user.type(within(modal).getByLabelText('Quantité rendue de Riz parfumé 25 kg'), '3')
    await user.type(within(modal).getByLabelText('Motif du retour'), 'Sac percé')
    await user.click(within(modal).getByRole('button', { name: 'Enregistrer le retour' }))
    expect(await within(modal).findByText('« Riz parfumé 25 kg » : quantité retournable dépassée')).toBeInTheDocument()

    const quantity = within(modal).getByLabelText('Quantité rendue de Riz parfumé 25 kg')
    await user.clear(quantity)
    await user.type(quantity, '1')
    await user.click(within(modal).getByRole('button', { name: 'Enregistrer le retour' }))

    expect(await screen.findByText('Retour BTQ1-RT-2026-000001 enregistré')).toBeInTheDocument()
    expect(requestsTo('POST', '/api/pos/returns')[0]?.body).toEqual({
      saleId: 'sale-seed',
      reason: 'Sac percé',
      lines: [{ saleLineId: 'sl-seed', quantity: '1', restock: true }],
      refundTo: 'method',
      refundMethodId: cashMethod.id,
    })
  })
})
