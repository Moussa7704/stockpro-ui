import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { meResponse } from '../../test/fixtures'
import { mockPurchasesApi } from '../../test/purchasesApi'
import { renderApp } from '../../test/render'
import { mockStockApi } from '../../test/stockApi'

const buyer = meResponse({ permissions: ['purchases.manage', 'supplier_payments.manage', 'products.view', 'stock.view'] })

/** Tiroir dont le titre est `title` (antd ne lui donne pas de nom accessible). */
async function drawerTitled(title: string) {
  const heading = await screen.findByText(title, { selector: '.ant-drawer-title' })
  return heading.closest('[role="dialog"]') as HTMLElement
}

/** Bouton de confirmation de la bulle « Popconfirm » (le dernier affiché). */
async function confirm(label: string) {
  const buttons = await screen.findAllByRole('button', { name: label })
  return buttons.at(-1)!
}

function setup(options?: { failFirstValidation?: boolean }) {
  mockStockApi()
  return mockPurchasesApi(options)
}

describe('Bons de commande', () => {
  it('crée une commande (coût proposé : prix d’achat indicatif) puis l’envoie', async () => {
    const { lastRequest } = setup()
    const { user } = renderApp('/purchases/orders', { session: buyer })

    await user.click(await screen.findByRole('button', { name: /Nouveau bon de commande/ }))
    const drawer = await drawerTitled('Nouveau bon de commande')
    await user.click(within(drawer).getByLabelText('Fournisseur'))
    await user.click(await screen.findByTitle('Grossiste du port'))
    await user.type(within(drawer).getByLabelText('Ajouter un produit'), '6001234567890{Enter}')
    await user.type(await within(drawer).findByLabelText('Quantité commandée de Riz parfumé 25 kg'), '10')
    // 10 × 12 500 = 125 000 (total indicatif)
    expect(within(drawer).getAllByText('125 000 FCFA').length).toBeGreaterThan(0)
    await user.click(within(drawer).getByRole('button', { name: 'Créer le bon de commande' }))

    expect(await screen.findByText('Bon de commande BTQ1-BC-2026-000008 créé')).toBeInTheDocument()
    expect(lastRequest('POST', '/api/purchases/orders')?.body).toEqual({
      shopId: 'shop-1',
      supplierId: 'sup-1',
      expectedAt: null,
      notes: null,
      lines: [{ productId: 'p-rice', quantity: '10', unitCost: '12500.00' }],
    })

    const detail = await drawerTitled('Commande BTQ1-BC-2026-000008')
    await user.click(within(detail).getByRole('button', { name: 'Envoyer' }))
    await user.click(await confirm('Envoyer'))
    expect(await screen.findByText('Commande BTQ1-BC-2026-000008 envoyée')).toBeInTheDocument()
    expect(lastRequest('POST', '/api/purchases/orders/po-new/send')).toBeDefined()
  })

  it('réceptionne une commande : reste à recevoir repris, puis validation idempotente', async () => {
    const { lastRequest } = setup()
    const { user } = renderApp('/purchases/orders', { session: buyer })

    await user.click(await screen.findByRole('button', { name: 'Ouvrir BTQ1-BC-2026-000007' }))
    const detail = await drawerTitled('Commande BTQ1-BC-2026-000007')
    await user.click(within(detail).getByRole('button', { name: 'Réceptionner' }))

    const form = await drawerTitled('Réception de la commande BTQ1-BC-2026-000007')
    const quantity = within(form).getByLabelText('Quantité reçue de Riz parfumé 25 kg')
    expect(Number((quantity as HTMLInputElement).value)).toBe(10)
    await user.clear(quantity)
    await user.type(quantity, '6')
    await user.click(within(form).getByRole('button', { name: 'Valider la réception' }))
    await user.click(await confirm('Valider'))

    expect(await screen.findByText(/Réception BTQ1-REC-2026-000001 validée : stock mis à jour/)).toBeInTheDocument()
    expect(lastRequest('POST', '/api/purchases/receipts')?.body).toMatchObject({
      orderId: 'po-sent',
      lines: [{ productId: 'p-rice', quantity: '6', unitCost: '12500.00', orderLineId: 'pol-1' }],
    })
    expect(lastRequest('POST', '/api/purchases/receipts/rec-1/validate')?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('coupure pendant la validation : on réessaie sans créer une seconde réception, avec la même clé', async () => {
    const { requestsTo } = setup({ failFirstValidation: true })
    const { user } = renderApp('/purchases/receipts', { session: buyer })

    await user.click(await screen.findByRole('button', { name: /Nouvelle réception/ }))
    const form = await drawerTitled('Nouvelle réception')
    await user.click(within(form).getByLabelText('Fournisseur'))
    await user.click(await screen.findByTitle('Grossiste du port'))
    await user.type(within(form).getByLabelText('Ajouter un produit'), 'RIZ-25{Enter}')
    await user.type(await within(form).findByLabelText('Quantité reçue de Riz parfumé 25 kg'), '5')

    await user.click(within(form).getByRole('button', { name: 'Valider la réception' }))
    await user.click(await confirm('Valider'))
    expect(await within(form).findByText('Impossible de joindre le serveur.')).toBeInTheDocument()

    // La bulle du premier essai finit de se fermer : on vise le bouton directement
    await user.click(within(form).getByText('Valider la réception').closest('button')!)
    await user.click(await confirm('Valider'))
    expect(await screen.findByText(/Réception BTQ1-REC-2026-000001 validée/)).toBeInTheDocument()

    expect(requestsTo('POST', '/api/purchases/receipts')).toHaveLength(1)
    const validations = requestsTo('POST', '/api/purchases/receipts/rec-1/validate')
    expect(validations).toHaveLength(2)
    expect(validations[0]!.idempotencyKey).toBe(validations[1]!.idempotencyKey)
  })
})

describe('Retours fournisseurs', () => {
  it('motif obligatoire ; sans coût, le retour part au coût moyen ; validation', async () => {
    const { lastRequest } = setup()
    const { user } = renderApp('/purchases/returns', { session: buyer })

    await user.click(await screen.findByRole('button', { name: /Nouveau retour/ }))
    const form = await drawerTitled('Nouveau retour fournisseur')
    await user.click(within(form).getByLabelText('Fournisseur'))
    await user.click(await screen.findByTitle('Grossiste du port'))
    await user.type(within(form).getByLabelText('Ajouter un produit'), 'SUCRE{Enter}')
    await user.type(await within(form).findByLabelText('Quantité retournée de Sucre en poudre'), '2')
    await user.click(within(form).getByRole('button', { name: 'Préparer le retour' }))
    expect(await within(form).findByText('Indiquez le motif du retour')).toBeInTheDocument()

    await user.type(within(form).getByLabelText('Motif'), 'Sacs percés à la livraison')
    await user.click(within(form).getByRole('button', { name: 'Préparer le retour' }))

    expect(await screen.findByText(/Retour BTQ1-RF-2026-000001 préparé/)).toBeInTheDocument()
    expect(lastRequest('POST', '/api/purchases/returns')?.body).toEqual({
      shopId: 'shop-1',
      supplierId: 'sup-1',
      reason: 'Sacs percés à la livraison',
      lines: [{ productId: 'p-sugar', quantity: '2' }],
    })

    const detail = await drawerTitled('Retour BTQ1-RF-2026-000001')
    await user.click(within(detail).getByRole('button', { name: 'Valider le retour' }))
    await user.click(await confirm('Valider'))
    expect(await screen.findByText('Retour BTQ1-RF-2026-000001 validé : stock mis à jour')).toBeInTheDocument()
  })
})

describe('Factures et paiements', () => {
  it('facture échue signalée ; un paiement ne dépasse jamais le reste dû', async () => {
    const { lastRequest } = setup()
    const { user } = renderApp('/purchases/invoices', { session: buyer })

    const row = (await screen.findByText('FA-0451')).closest('tr')!
    expect(within(row).getByText('Échue')).toBeInTheDocument()
    await user.click(within(row).getByRole('button', { name: 'Ouvrir la facture FA-0451' }))

    const detail = await drawerTitled('Facture FA-0451')
    const amount = within(detail).getByLabelText('Montant du paiement')
    expect(amount).toHaveValue('60 000')
    await user.clear(amount)
    await user.type(amount, '70000')
    await user.click(within(detail).getByRole('button', { name: 'Enregistrer le paiement' }))
    expect(await within(detail).findByText('Le montant dépasse le reste dû')).toBeInTheDocument()
    expect(lastRequest('POST', '/api/purchases/invoices/inv-1/payments')).toBeUndefined()

    await user.clear(amount)
    await user.type(amount, '60000')
    await user.click(within(detail).getByRole('button', { name: 'Enregistrer le paiement' }))
    expect(await screen.findByText('Facture FA-0451 soldée')).toBeInTheDocument()
    expect(lastRequest('POST', '/api/purchases/invoices/inv-1/payments')).toMatchObject({
      body: { amount: '60000', method: 'bank_transfer' },
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    })
  })

  it('enregistre une facture ; l’échéance ne peut pas précéder la date', async () => {
    const { lastRequest } = setup()
    const { user } = renderApp('/purchases/invoices', { session: buyer })

    await user.click(await screen.findByRole('button', { name: /Nouvelle facture/ }))
    const modal = await screen.findByRole('dialog')
    await user.click(within(modal).getByLabelText('Fournisseur'))
    await user.click(await screen.findByTitle('Grossiste du port'))
    await user.type(within(modal).getByLabelText('N° de facture'), 'FA-0500')
    await user.type(within(modal).getByLabelText('Montant total'), '250000')
    await user.click(within(modal).getByRole('button', { name: 'Enregistrer la facture' }))

    expect(await screen.findByText('Facture FA-0500 enregistrée')).toBeInTheDocument()
    expect(lastRequest('POST', '/api/purchases/invoices')?.body).toMatchObject({ supplierId: 'sup-1', reference: 'FA-0500', total: '250000', dueDate: null })
  })

  it('dettes fournisseurs : reste dû et part échue', async () => {
    setup()
    const { user } = renderApp('/purchases/invoices', { session: buyer })

    await user.click(await screen.findByText('Dettes fournisseurs'))
    const table = await screen.findByRole('table')
    const row = (await within(table).findByText('Grossiste du port')).closest('tr')!
    expect(within(row).getAllByText('60 000 FCFA')).toHaveLength(2)
    expect(screen.getByText('Total dû aux fournisseurs')).toBeInTheDocument()
  })
})

describe('Menu Achats', () => {
  it('factures masquées sans supplier_payments.manage', async () => {
    setup()
    renderApp('/', { session: meResponse({ permissions: ['purchases.manage'] }) })

    const menu = await screen.findByRole('menu')
    expect(within(menu).getByText('Bons de commande')).toBeInTheDocument()
    await waitFor(() => expect(within(menu).queryByText('Factures et paiements')).not.toBeInTheDocument())
  })
})
