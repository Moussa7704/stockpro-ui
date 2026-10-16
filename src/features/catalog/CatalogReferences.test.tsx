import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useCatalogApi } from '../../test/catalogApi'
import { meResponse } from '../../test/fixtures'
import { renderApp } from '../../test/render'

const manager = meResponse({ permissions: ['products.view', 'products.manage', 'purchases.manage'] })
const viewer = meResponse({ permissions: ['products.view'], roleCode: 'cashier' })

describe('Catégories', () => {
  it('affiche l’arbre et ajoute une sous-catégorie sous le bon parent', async () => {
    const { lastRequest } = useCatalogApi()
    const { user } = renderApp('/categories', { session: manager })

    // Riz est affiché sous Épicerie (arbre déplié)
    expect(await screen.findByText('Épicerie')).toBeInTheDocument()
    expect(screen.getByText('Riz')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ajouter une sous-catégorie à Boissons' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Nom'), 'Jus de fruits')
    await user.click(within(dialog).getByRole('button', { name: 'Créer la catégorie' }))

    expect(await screen.findByText('Catégorie « Jus de fruits » créée')).toBeInTheDocument()
    expect(lastRequest('POST', '/api/categories')?.body).toEqual({ name: 'Jus de fruits', parentId: 'c-drinks' })
    expect(await screen.findByText('Jus de fruits')).toBeInTheDocument()
  })

  it('une catégorie ne peut pas devenir sa propre sous-catégorie', async () => {
    useCatalogApi()
    const { user } = renderApp('/categories', { session: manager })

    await user.click(await screen.findByRole('button', { name: 'Modifier Épicerie' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByLabelText('Catégorie parente'))

    // Elle-même et sa descendante « Riz » sont grisées ; « Boissons » reste possible
    const disabled = (title: string) =>
      screen.getAllByTitle(title).some((element) => element.closest('.ant-select-tree-treenode-disabled') !== null)
    await waitFor(() => expect(disabled('Riz')).toBe(true))
    expect(disabled('Épicerie')).toBe(true)
    expect(disabled('Boissons')).toBe(false)
  })

  it('consultation seule : aucun bouton de gestion', async () => {
    useCatalogApi()
    renderApp('/categories', { session: viewer })

    expect(await screen.findByText('Épicerie')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Nouvelle catégorie/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Modifier/ })).not.toBeInTheDocument()
  })
})

describe('Unités', () => {
  it('crée une unité à quantités décimales', async () => {
    const { lastRequest } = useCatalogApi()
    const { user } = renderApp('/units', { session: manager })

    expect(await screen.findByText('Kilogramme')).toBeInTheDocument()
    expect(screen.getByText('Entières seulement')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Nouvelle unité/ }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Nom'), 'Litre')
    await user.type(within(dialog).getByLabelText('Symbole'), 'L')
    await user.click(within(dialog).getByRole('switch', { name: 'Quantités décimales' }))
    await user.click(within(dialog).getByRole('button', { name: 'Créer l’unité' }))

    expect(await screen.findByText('Unité « Litre » créée')).toBeInTheDocument()
    expect(lastRequest('POST', '/api/units')?.body).toEqual({ name: 'Litre', symbol: 'L', allowsDecimal: true })
  })
})

describe('Fournisseurs', () => {
  it('recherche côté serveur et crée un fournisseur', async () => {
    const { lastRequest } = useCatalogApi()
    const { user } = renderApp('/suppliers', { session: manager })

    expect(await screen.findByText('Grossiste du port')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Rechercher un fournisseur'), 'zzz')
    expect(await screen.findByText('Aucun fournisseur ne correspond')).toBeInTheDocument()
    expect(lastRequest('GET', '/api/suppliers')?.search).toContain('search=zzz')
    await user.clear(screen.getByLabelText('Rechercher un fournisseur'))

    await user.click(screen.getByRole('button', { name: /Nouveau fournisseur/ }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Raison sociale'), 'Brasserie du Sahel')
    await user.type(within(dialog).getByLabelText('Téléphone'), '+221 33 800 00 00')
    await user.click(within(dialog).getByRole('button', { name: 'Créer le fournisseur' }))

    expect(await screen.findByText('Fournisseur « Brasserie du Sahel » créé')).toBeInTheDocument()
    expect(lastRequest('POST', '/api/suppliers')?.body).toMatchObject({ name: 'Brasserie du Sahel', phone: '+221 33 800 00 00' })
    expect(await screen.findByText('Brasserie du Sahel')).toBeInTheDocument()
  })

  it('sans purchases.manage : consultation seulement', async () => {
    useCatalogApi()
    renderApp('/suppliers', { session: viewer })

    expect(await screen.findByText('Grossiste du port')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Nouveau fournisseur/ })).not.toBeInTheDocument()
  })
})

describe('Menu Catalogue', () => {
  it('visible avec products.view, absent sinon', async () => {
    useCatalogApi()
    renderApp('/', { session: viewer })
    const menu = await screen.findByRole('menu')
    expect(within(menu).getByText('Produits')).toBeInTheDocument()
    expect(within(menu).getByText('Fournisseurs')).toBeInTheDocument()
  })
})
