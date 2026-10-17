import { screen, waitFor, within } from '@testing-library/react'
import { http as mock, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { mockCatalogApi } from '../../test/catalogApi'
import { meResponse } from '../../test/fixtures'
import { renderApp } from '../../test/render'
import { server } from '../../test/server'

const manager = meResponse({ permissions: ['products.view', 'products.manage', 'prices.manage', 'reports.view'] })

describe('Produits : liste', () => {
  it('affiche prix en FCFA, catégorie, référence ; recherche côté serveur', async () => {
    const { lastRequest } = mockCatalogApi()
    const { user } = renderApp('/products', { session: manager })

    expect(await screen.findByText('Riz parfumé 25 kg')).toBeInTheDocument()
    // Testing Library ramène les espaces insécables à des espaces simples
    expect(screen.getByText('15 000 FCFA')).toBeInTheDocument()
    expect(screen.getByText('2 produit(s)')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Rechercher un produit'), 'sucre')
    await waitFor(() => expect(lastRequest('GET', '/api/products')?.search).toContain('search=sucre'))
    await waitFor(() => expect(screen.queryByText('Riz parfumé 25 kg')).not.toBeInTheDocument())
    expect(screen.getByText('Sucre en poudre')).toBeInTheDocument()
  })

  it('tri et statut demandés au serveur', async () => {
    const { lastRequest } = mockCatalogApi()
    const { user } = renderApp('/products', { session: manager })
    await screen.findByText('Riz parfumé 25 kg')

    await user.click(screen.getByRole('columnheader', { name: /Prix de vente/ }))
    await waitFor(() => expect(lastRequest('GET', '/api/products')?.search).toMatch(/sort=salePrice&order=asc/))

    await user.click(screen.getByText('Archivés'))
    await waitFor(() => expect(lastRequest('GET', '/api/products')?.search).toContain('status=archived'))
    expect(await screen.findByText('Aucun produit')).toBeInTheDocument()
  })

  it('consultation seule (caissier) : ni création, ni modification, ni prix d’achat', async () => {
    mockCatalogApi()
    renderApp('/products', { session: meResponse({ permissions: ['products.view'], roleCode: 'cashier' }) })

    expect(await screen.findByText('Riz parfumé 25 kg')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Nouveau produit/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Modifier/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Prix d’achat ind.')).not.toBeInTheDocument()
  })
})

describe('Produits : fiche', () => {
  it('crée un produit : SKU en majuscules, un scan (Entrée) ne valide pas le formulaire', async () => {
    const { db, lastRequest } = mockCatalogApi()
    const { user } = renderApp('/products', { session: manager })

    await user.click(await screen.findByRole('button', { name: /Nouveau produit/ }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Désignation'), 'Huile 1 L')
    await user.type(within(dialog).getByLabelText('Référence (SKU)'), 'huile 1l')
    // Douchette : le code puis "Entrée"
    await user.type(within(dialog).getByLabelText('Code-barres'), '6001234567890{Enter}')
    expect(lastRequest('POST', '/api/products')).toBeUndefined()

    await user.type(within(dialog).getByLabelText('Prix de vente'), '1500')
    await user.click(within(dialog).getByRole('button', { name: 'Créer le produit' }))

    expect(await screen.findByText('Produit « Huile 1 L » créé')).toBeInTheDocument()
    expect(lastRequest('POST', '/api/products')?.body).toMatchObject({
      name: 'Huile 1 L',
      sku: 'HUILE1L',
      barcode: '6001234567890',
      unitId: 'u-pce', // unité « Pièce » proposée par défaut
      salePrice: '1500',
      alertThreshold: '0',
    })
    expect(db.products).toHaveLength(3)
  })

  it('sans prices.manage : prix grisés, et seul ce qui change est envoyé', async () => {
    const { lastRequest } = mockCatalogApi()
    const { user } = renderApp('/products', { session: meResponse({ permissions: ['products.view', 'products.manage'] }) })

    await user.click(await screen.findByRole('button', { name: 'Modifier Riz parfumé 25 kg' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText('Prix de vente')).toBeDisabled()
    expect(within(dialog).getByText(/Modifier un prix demande la permission/)).toBeInTheDocument()

    const name = within(dialog).getByLabelText('Désignation')
    await user.clear(name)
    await user.type(name, 'Riz parfumé 25 kg (sac)')
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Produit « Riz parfumé 25 kg (sac) » mis à jour')).toBeInTheDocument()
    expect(lastRequest('PATCH', '/api/products/p-rice')?.body).toEqual({ name: 'Riz parfumé 25 kg (sac)' })
  })

  it('archive un produit après confirmation', async () => {
    const { lastRequest } = mockCatalogApi()
    const { user } = renderApp('/products', { session: manager })

    await user.click(await screen.findByRole('button', { name: 'Archiver Sucre en poudre' }))
    await user.click(await screen.findByRole('button', { name: 'Archiver' }))

    expect(await screen.findByText('« Sucre en poudre » archivé')).toBeInTheDocument()
    expect(lastRequest('PATCH', '/api/products/p-sugar')?.body).toEqual({ status: 'archived' })
    await waitFor(() => expect(screen.queryByText('Sucre en poudre')).not.toBeInTheDocument())
  })
})

describe('Produits : stock par boutique', () => {
  const stockHandler = (withCosts: boolean) =>
    mock.get('/api/stock/products/:id', () =>
      HttpResponse.json({
        product: { id: 'p-rice', sku: 'RIZ-25', name: 'Riz parfumé 25 kg' },
        stock: [
          { shop: { id: 'shop-1', code: 'BTQ1', name: 'Boutique Centre' }, quantity: '12.000', ...(withCosts && { averageCost: '12000.0000' }) },
          { shop: { id: 'shop-2', code: 'BTQ2', name: 'Boutique Marché' }, quantity: '3.000', ...(withCosts && { averageCost: '12500.0000' }) },
          { shop: { id: 'shop-3', code: 'DEP', name: 'Dépôt' }, quantity: '0.000', ...(withCosts && { averageCost: '0.0000' }) },
        ],
      }),
    )

  it('quantité, état en toutes lettres, coût et valeur par boutique, totaux, lien vers les mouvements', async () => {
    const { db } = mockCatalogApi()
    db.products[0]!.alertThreshold = '5.000'
    server.use(stockHandler(true))
    const { user } = renderApp('/products', { session: meResponse({ permissions: ['products.view', 'stock.view', 'reports.view'] }) })

    await user.click(await screen.findByRole('button', { name: 'Stock de Riz parfumé 25 kg par boutique' }))

    const drawer = (await screen.findByText('Stock par boutique — Riz parfumé 25 kg', { selector: '.ant-drawer-title' })).closest('[role="dialog"]') as HTMLElement
    expect(await within(drawer).findByText('Boutique Centre')).toBeInTheDocument()
    expect(within(drawer).getByText(/seuil d’alerte : 5 pce/)).toBeInTheDocument()
    const rows = within(drawer).getAllByRole('row')
    const row = (name: string) => rows.find((item) => within(item).queryByText(name))!
    expect(within(row('Boutique Centre')).getByText('Disponible')).toBeInTheDocument()
    expect(within(row('Boutique Marché')).getByText('Stock bas')).toBeInTheDocument()
    expect(within(row('Dépôt')).getByText('Rupture')).toBeInTheDocument()
    // 12 × 12 000 + 3 × 12 500 = 181 500
    expect(within(row('Boutique Centre')).getByText('144 000 FCFA')).toBeInTheDocument()
    const total = row('Total')
    expect(within(total).getByText(/15\s*pce/)).toBeInTheDocument()
    expect(within(total).getByText('181 500 FCFA')).toBeInTheDocument()
    expect(within(drawer).getByRole('link', { name: /Voir les mouvements de ce produit/ })).toHaveAttribute('href', expect.stringContaining('productId=p-rice'))
  })

  it('sans accès aux coûts : ni coût moyen ni valeur', async () => {
    mockCatalogApi()
    server.use(stockHandler(false))
    const { user } = renderApp('/products', { session: meResponse({ permissions: ['products.view', 'stock.view'] }) })

    await user.click(await screen.findByRole('button', { name: 'Stock de Riz parfumé 25 kg par boutique' }))

    const drawer = (await screen.findByText('Stock par boutique — Riz parfumé 25 kg', { selector: '.ant-drawer-title' })).closest('[role="dialog"]') as HTMLElement
    expect(await within(drawer).findByText('Boutique Centre')).toBeInTheDocument()
    expect(within(drawer).queryByText('Coût moyen')).not.toBeInTheDocument()
    expect(within(drawer).queryByText('Valeur')).not.toBeInTheDocument()
  })

  it('sans stock.view : pas de bouton de stock', async () => {
    mockCatalogApi()
    renderApp('/products', { session: meResponse({ permissions: ['products.view'] }) })

    await screen.findByText('Riz parfumé 25 kg')
    expect(screen.queryByRole('button', { name: /par boutique/ })).not.toBeInTheDocument()
  })
})
