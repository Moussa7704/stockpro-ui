import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { meResponse } from '../../test/fixtures'
import { renderApp } from '../../test/render'
import { mockStockApi } from '../../test/stockApi'

const keeper = meResponse({ permissions: ['stock.view', 'stock.adjust', 'stock.transfer', 'products.view'] })
const viewer = meResponse({ permissions: ['stock.view', 'products.view'], roleCode: 'cashier' })

describe('Niveaux de stock', () => {
  it('quantités, stock bas signalé, valeur au coût moyen pour qui voit les coûts', async () => {
    mockStockApi()
    renderApp('/stock', { session: keeper })

    const row = (await screen.findByText('Riz parfumé 25 kg')).closest('tr')!
    expect(within(row).getByText(/3 pce/)).toHaveClass('text-red-600')
    expect(within(row).getByText('36 000 FCFA')).toBeInTheDocument()
    expect(screen.getByText(/42,5 kg/)).toBeInTheDocument()
  })

  it('sans droit aux coûts : ni coût moyen ni valeur', async () => {
    mockStockApi({ withCosts: false })
    renderApp('/stock', { session: viewer })

    expect(await screen.findByText('Riz parfumé 25 kg')).toBeInTheDocument()
    expect(screen.queryByText('Valeur')).not.toBeInTheDocument()
  })

  it('filtre « stock bas » côté serveur et vue des alertes avec leur nombre', async () => {
    const { lastRequest } = mockStockApi()
    const { user } = renderApp('/stock', { session: keeper })
    await screen.findByText('Riz parfumé 25 kg')

    await user.click(screen.getByText('Stock bas'))
    await waitFor(() => expect(lastRequest('GET', '/api/stock')?.search).toContain('lowStock=true'))
    await waitFor(() => expect(screen.queryByText('Sucre en poudre')).not.toBeInTheDocument())

    await user.click(screen.getByText('Alertes'))
    const table = await screen.findByRole('table')
    expect(within(table).getByText('Riz parfumé 25 kg')).toBeInTheDocument()
    expect(within(table).getByText('Stock bas')).toBeInTheDocument()
  })

  it('/stock?vue=alertes ouvre directement les alertes (lien du tableau de bord)', async () => {
    mockStockApi()
    renderApp('/stock?vue=alertes', { session: keeper })

    const table = await screen.findByRole('table')
    expect(await within(table).findByText('Riz parfumé 25 kg')).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'État' })).toBeInTheDocument()
    expect(within(table).getByText(/3\s*pce/)).toBeInTheDocument()
    // Vue des alertes : pas de recherche ni de filtre « stock bas »
    expect(screen.queryByLabelText('Rechercher un produit')).not.toBeInTheDocument()
  })

  it('ouvre les mouvements d’un produit : filtre transmis, quantités signées', async () => {
    const { lastRequest } = mockStockApi()
    const { user } = renderApp('/stock', { session: keeper })

    await user.click(await screen.findByRole('link', { name: 'Mouvements de Riz parfumé 25 kg' }))

    expect(await screen.findByText('Produit : Riz parfumé 25 kg')).toBeInTheDocument()
    await waitFor(() => expect(lastRequest('GET', '/api/stock/movements')?.search).toContain('productId=p-rice'))
    expect(await screen.findByText('−2')).toHaveClass('text-red-600')
    expect(screen.getByText('+5')).toHaveClass('text-green-700')
    expect(screen.getByText('Vente')).toBeInTheDocument()
  })
})

describe('Ajustements', () => {
  it('stock initial : produit scanné, entrée au coût indicatif', async () => {
    const { lastRequest } = mockStockApi()
    const { user } = renderApp('/stock/adjustments', { session: keeper })

    await user.click(await screen.findByRole('button', { name: /Nouvel ajustement/ }))
    const drawer = await screen.findByRole('dialog')
    // Douchette : code-barres puis Entrée
    await user.type(within(drawer).getByLabelText('Ajouter un produit'), '6001234567890{Enter}')
    expect(await within(drawer).findByText('Riz parfumé 25 kg')).toBeInTheDocument()
    await user.type(within(drawer).getByLabelText('Quantité de Riz parfumé 25 kg'), '20')
    await user.click(within(drawer).getByRole('button', { name: 'Enregistrer l’ajustement' }))

    expect(await screen.findByText('Ajustement BTQ1-AJ-2026-000001 enregistré')).toBeInTheDocument()
    expect(lastRequest('POST', '/api/stock/adjustments')?.body).toEqual({
      shopId: 'shop-1',
      reason: 'opening_balance',
      notes: null,
      lines: [{ productId: 'p-rice', quantity: '20', unitCost: '12500.00' }],
    })
  })

  it('casse : la quantité part en sortie (négative), sans coût', async () => {
    const { lastRequest } = mockStockApi()
    const { user } = renderApp('/stock/adjustments', { session: keeper })

    await user.click(await screen.findByRole('button', { name: /Nouvel ajustement/ }))
    const drawer = await screen.findByRole('dialog')
    await user.click(within(drawer).getByLabelText('Motif'))
    await user.click(await screen.findByTitle('Casse'))
    // Recherche par nom (référence saisie : trouvée par le SKU)
    await user.type(within(drawer).getByLabelText('Ajouter un produit'), 'SUCRE{Enter}')
    await user.type(await within(drawer).findByLabelText('Quantité de Sucre en poudre'), '1.5')
    expect(within(drawer).getByText('coût moyen')).toBeInTheDocument()
    await user.click(within(drawer).getByRole('button', { name: 'Enregistrer l’ajustement' }))

    await screen.findByText('Ajustement BTQ1-AJ-2026-000001 enregistré')
    expect(lastRequest('POST', '/api/stock/adjustments')?.body).toMatchObject({
      reason: 'damage',
      lines: [{ productId: 'p-sugar', quantity: '-1.5' }],
    })
  })

  it('refuse un ajustement sans quantité, et un code inconnu est signalé', async () => {
    const { lastRequest } = mockStockApi()
    const { user } = renderApp('/stock/adjustments', { session: keeper })

    await user.click(await screen.findByRole('button', { name: /Nouvel ajustement/ }))
    const drawer = await screen.findByRole('dialog')
    await user.type(within(drawer).getByLabelText('Ajouter un produit'), '0000000{Enter}')
    expect(await screen.findByText('Aucun produit pour le code « 0000000 »')).toBeInTheDocument()

    await user.click(within(drawer).getByRole('button', { name: 'Enregistrer l’ajustement' }))
    expect(await within(drawer).findByText('Ajoutez au moins un produit')).toBeInTheDocument()
    expect(lastRequest('POST', '/api/stock/adjustments')).toBeUndefined()
  })

  it('consultation seule : pas de bouton d’ajustement', async () => {
    mockStockApi()
    renderApp('/stock/adjustments', { session: viewer })
    expect(await screen.findByText('Aucun ajustement')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Nouvel ajustement/ })).not.toBeInTheDocument()
  })
})

describe('Transferts', () => {
  it('prépare, expédie puis réceptionne avec un écart', async () => {
    const { lastRequest } = mockStockApi()
    const { user } = renderApp('/stock/transfers', { session: keeper })

    await user.click(await screen.findByRole('button', { name: /Nouveau transfert/ }))
    let drawer = await screen.findByRole('dialog')
    await user.click(within(drawer).getByLabelText('Boutique d’arrivée'))
    await user.click(await screen.findByTitle('Boutique Marché'))
    await user.type(within(drawer).getByLabelText('Ajouter un produit'), 'RIZ-25{Enter}')
    await user.type(await within(drawer).findByLabelText('Quantité de Riz parfumé 25 kg'), '10')
    await user.click(within(drawer).getByRole('button', { name: 'Préparer le transfert' }))

    expect(await screen.findByText(/BTQ1-TR-2026-000001 préparé/)).toBeInTheDocument()
    expect(lastRequest('POST', '/api/stock/transfers')?.body).toEqual({
      fromShopId: 'shop-1',
      toShopId: 'shop-2',
      notes: null,
      lines: [{ productId: 'p-rice', quantity: '10' }],
    })

    // Le détail s'ouvre sur le brouillon : expédition
    const title = await screen.findByText('Transfert BTQ1-TR-2026-000001', { selector: '.ant-drawer-title' })
    drawer = title.closest('[role="dialog"]') as HTMLElement
    await user.click(within(drawer).getByRole('button', { name: 'Expédier' }))
    // Confirmation : le bouton « Expédier » de la bulle (le dernier affiché)
    await user.click((await screen.findAllByRole('button', { name: 'Expédier' })).at(-1)!)
    expect(await screen.findByText('Transfert BTQ1-TR-2026-000001 expédié')).toBeInTheDocument()
    expect(await within(drawer).findByText('En route')).toBeInTheDocument()

    // Réception : 9 reçus sur 10
    await user.click(within(drawer).getByRole('button', { name: 'Réceptionner' }))
    const received = within(drawer).getByLabelText('Quantité reçue de Riz parfumé 25 kg')
    await user.clear(received)
    await user.type(received, '9')
    await user.click(within(drawer).getByRole('button', { name: 'Confirmer la réception' }))

    expect(await screen.findByText('Transfert BTQ1-TR-2026-000001 réceptionné')).toBeInTheDocument()
    expect(lastRequest('POST', '/api/stock/transfers/tr-1/receive')?.body).toEqual({ lines: [{ lineId: 'tl-1', quantityReceived: '9' }] })
    expect(await within(drawer).findByText('9')).toHaveClass('text-red-600')
  })
})

describe('Inventaires', () => {
  it('compte à la douchette (+1 par passage), enregistre, valide et affiche les écarts', async () => {
    const { lastRequest } = mockStockApi()
    const { user, router } = renderApp('/stock/inventories', { session: keeper })

    await user.click(await screen.findByRole('button', { name: /Nouvel inventaire/ }))
    const modal = await screen.findByRole('dialog')
    await user.click(within(modal).getByRole('button', { name: 'Commencer le comptage' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/stock/inventories/inv-1'))

    const picker = await screen.findByLabelText('Ajouter un produit')
    await user.type(picker, '6001234567890{Enter}')
    await screen.findByLabelText('Quantité comptée de Riz parfumé 25 kg')
    await user.type(screen.getByLabelText('Ajouter un produit'), '6001234567890{Enter}')
    await waitFor(() => expect(screen.getByLabelText('Quantité comptée de Riz parfumé 25 kg')).toHaveValue('2'))
    expect(screen.getByText('à enregistrer')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Enregistrer le comptage/ }))
    expect(await screen.findByText('Comptage enregistré')).toBeInTheDocument()
    expect(lastRequest('PUT', '/api/stock/inventories/inv-1/lines')?.body).toEqual({ lines: [{ productId: 'p-rice', countedQuantity: '2' }] })

    await user.click(screen.getByRole('button', { name: 'Valider l’inventaire' }))
    await user.click((await screen.findAllByRole('button', { name: 'Valider' })).at(-1)!)
    expect(await screen.findByText(/validé : les écarts ont été corrigés/)).toBeInTheDocument()
    // Théorique 3, compté 2 : écart −1
    expect(await screen.findByText('−1')).toHaveClass('text-red-600')
  })
})
