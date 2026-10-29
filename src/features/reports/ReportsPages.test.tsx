import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { meResponse, shopsFixture } from '../../test/fixtures'
import { renderApp } from '../../test/render'
import { mockReportsApi, stockAlert } from '../../test/reportsApi'
import { server } from '../../test/server'
import { http as mock, HttpResponse } from 'msw'

const manager = meResponse({ permissions: ['reports.view', 'stock.view', 'sales.create'] })
const cashier = meResponse({ permissions: ['sales.create', 'customers.manage', 'products.view'], roleCode: 'cashier' })

function setup(options?: Parameters<typeof mockReportsApi>[0]) {
  server.use(mock.get('/api/shops', () => HttpResponse.json({ shops: shopsFixture })))
  return mockReportsApi(options)
}

describe('Tableau de bord', () => {
  it('chiffres clés du jour et du mois, alertes reliées à leur écran', async () => {
    setup()
    renderApp('/', { session: manager })

    expect(await screen.findByText('150 000 FCFA')).toBeInTheDocument()
    // 150 000 contre 100 000 la veille
    expect(screen.getByText(/\+50 % vs hier/)).toBeInTheDocument()
    expect(screen.getByText('Taux de marge : 25,0 %')).toBeInTheDocument()
    // Résultat négatif : en rouge ET signalé par un mot
    expect(screen.getByText('-50 000 FCFA')).toHaveClass('text-red-600')
    expect(screen.getByText(/déficitaire/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /3 en stock bas · 1 en rupture/ })).toHaveAttribute('href', '/stock?vue=alertes')
    expect(screen.getByRole('link', { name: /2 client\(s\) débiteur\(s\)/ })).toHaveAttribute('href', '/debtors')
    const topProducts = screen.getByText('Meilleurs produits du mois').closest('.ant-card') as HTMLElement
    expect(within(topProducts).getByText('Riz parfumé 25 kg')).toBeInTheDocument()
  })

  it('le graphique des 7 jours a sa vue tableau (lecture sans couleurs)', async () => {
    setup()
    const { user } = renderApp('/', { session: manager })

    await screen.findByText('Chiffre d’affaires net — 7 derniers jours')
    // Le graphique porte un résumé textuel pour les lecteurs d'écran
    expect(screen.getByRole('img', { name: /Chiffre d’affaires net — 7 derniers jours : / })).toBeInTheDocument()
    await user.click(screen.getAllByTitle('Tableau')[0]!)
    expect(await screen.findByText('70 000 FCFA')).toBeInTheDocument()
    // « CA net » : colonne du tableau des 7 jours (et de celui des meilleurs produits)
    expect(screen.getAllByRole('columnheader', { name: 'CA net' }).length).toBeGreaterThanOrEqual(2)
  })

  it('suit la boutique choisie en haut de page, ou toutes', async () => {
    const { last } = setup()
    const { user } = renderApp('/', { session: manager })

    await screen.findByText('150 000 FCFA')
    // Par défaut : la première boutique accessible
    await waitFor(() => expect(last('/api/reports/dashboard')?.search.get('shopId')).toBe('shop-1'))
    await user.click(screen.getByLabelText('Boutique active'))
    await user.click(await screen.findByTitle('Boutique Marché'))
    await waitFor(() => expect(last('/api/reports/dashboard')?.search.get('shopId')).toBe('shop-2'))
    // La carte « À réapprovisionner » suit la même boutique
    await waitFor(() => expect(last('/api/stock/alerts')?.search.get('shopId')).toBe('shop-2'))

    await user.click(screen.getByLabelText('Boutique active'))
    await user.click(await screen.findByTitle('Toutes les boutiques'))
    await waitFor(() => expect(last('/api/reports/dashboard')?.search.has('shopId')).toBe(false))
  })

  it('sans accès aux rapports : accueil avec raccourcis, aucune donnée financière demandée', async () => {
    const { requests } = setup()
    renderApp('/', { session: cashier })

    expect(await screen.findByRole('button', { name: /Ouvrir la caisse/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Clients/ })).toBeInTheDocument()
    expect(requests.some((request) => request.path === '/api/reports/dashboard')).toBe(false)
    // Pas de stock.view : pas de carte « À réapprovisionner »
    expect(screen.queryByText('À réapprovisionner')).not.toBeInTheDocument()
    expect(requests.some((request) => request.path === '/api/stock/alerts')).toBe(false)
  })
})

describe('Tableau de bord — À réapprovisionner', () => {
  const restockCard = async () => (await screen.findByText('À réapprovisionner')).closest('.ant-card') as HTMLElement

  it('ruptures en tête, état en toutes lettres, unité, seuil absent signalé par un tiret', async () => {
    setup()
    renderApp('/', { session: manager })

    const card = await restockCard()
    await within(card).findByText('Sucre en poudre')
    const rows = within(card).getAllByRole('row').slice(1)
    expect(within(rows[0]!).getByText('Sucre en poudre')).toBeInTheDocument()
    expect(within(rows[0]!).getByText('Rupture')).toBeInTheDocument()
    expect(within(rows[0]!).getByText(/0\s*kg/)).toBeInTheDocument()
    expect(within(rows[0]!).getByText('—')).toBeInTheDocument()
    expect(within(rows[1]!).getByText('Riz parfumé 25 kg')).toBeInTheDocument()
    expect(within(rows[1]!).getByText('Stock bas')).toBeInTheDocument()
    expect(within(rows[1]!).getByText(/3\s*pce/)).toBeInTheDocument()
    expect(within(card).getByText('1 en rupture · 1 en stock bas')).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: 'Voir toutes les alertes' })).toHaveAttribute('href', '/stock?vue=alertes')
  })

  it('affiche les 10 plus urgents et renvoie vers la liste complète', async () => {
    setup({ alerts: Array.from({ length: 12 }, (_, index) => stockAlert(index + 1, index < 2 ? 'out_of_stock' : 'low_stock')) })
    renderApp('/', { session: manager })

    const card = await restockCard()
    await within(card).findByText('Produit 1')
    expect(within(card).getAllByRole('row')).toHaveLength(11) // en-tête + 10 lignes
    expect(within(card).queryByText('Produit 11')).not.toBeInTheDocument()
    expect(within(card).getByText(/Et 2 autre\(s\) produit\(s\)/)).toBeInTheDocument()
    expect(within(card).getByText('2 en rupture · 10 en stock bas')).toBeInTheDocument()
  })

  it('rien à réapprovisionner : message clair, pas de lien', async () => {
    setup({ alerts: [] })
    renderApp('/', { session: manager })

    const card = await restockCard()
    expect(await within(card).findByText(/Rien à réapprovisionner/)).toBeInTheDocument()
    expect(within(card).queryByRole('link', { name: 'Voir toutes les alertes' })).not.toBeInTheDocument()
  })

  it('sans accès aux rapports mais avec stock.view : la carte reste sur l’accueil', async () => {
    const { requests } = setup()
    renderApp('/', { session: meResponse({ permissions: ['stock.view', 'products.view'], roleCode: 'stock_keeper' }) })

    const card = await restockCard()
    expect(await within(card).findByText('Sucre en poudre')).toBeInTheDocument()
    expect(requests.some((request) => request.path === '/api/reports/dashboard')).toBe(false)
  })

  it('avec les rapports mais sans stock.view : pas de carte', async () => {
    const { requests } = setup()
    renderApp('/', { session: meResponse({ permissions: ['reports.view'] }) })

    await screen.findByText('150 000 FCFA')
    expect(screen.queryByText('À réapprovisionner')).not.toBeInTheDocument()
    expect(requests.some((request) => request.path === '/api/stock/alerts')).toBe(false)
  })
})

describe('Rapports', () => {
  beforeEach(() => {
    // jsdom ne sait pas créer de lien vers un fichier : on simule le téléchargement
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:fichier'), revokeObjectURL: vi.fn() }))
  })
  afterEach(() => vi.restoreAllMocks())

  it('ventes : totaux, tableau par période, regroupement demandé au serveur', async () => {
    const { last } = setup()
    const { user } = renderApp('/reports', { session: manager })

    // Dans la tuile du CA net et dans le total du tableau
    expect((await screen.findAllByText('250 000 FCFA')).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('16/10')).toBeInTheDocument()
    expect(last('/api/reports/sales')?.search.get('groupBy')).toBe('day')

    await user.click(screen.getByText('Par mois'))
    await waitFor(() => expect(last('/api/reports/sales')?.search.get('groupBy')).toBe('month'))
  })

  it('export Excel : le fichier du serveur est téléchargé avec son nom', async () => {
    const { last } = setup()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const { user } = renderApp('/reports', { session: manager })

    await user.click(await screen.findByRole('button', { name: /Excel/ }))
    await waitFor(() => expect(click).toHaveBeenCalled())
    const anchor = click.mock.instances[0] as unknown as HTMLAnchorElement
    expect(anchor.download).toMatch(/^ventes_\d{4}-\d{2}-01_\d{4}-\d{2}-\d{2}\.xlsx$/)
    expect(last('/api/reports/sales')?.search.get('format')).toBe('xlsx')
  })

  it('export refusé : le message du serveur s’affiche (relu dans la réponse binaire)', async () => {
    setup({ failExport: true })
    const { user } = renderApp('/reports', { session: manager })

    await user.click(await screen.findByRole('button', { name: /PDF/ }))
    expect(await screen.findByText('Période limitée à deux ans')).toBeInTheDocument()
  })

  it('compte de résultat : résultat négatif signalé', async () => {
    setup()
    const { user } = renderApp('/reports?rapport=profit-and-loss', { session: manager })

    expect(await screen.findByText(/Résultat net estimé \(déficit\)/)).toBeInTheDocument()
    expect(screen.getByText('-20 000 FCFA')).toHaveClass('text-red-600')
    expect(screen.getByText('− Dépenses : Loyer')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Dépenses' }))
    await user.click(await screen.findByTitle('Tableau'))
    const table = await screen.findByRole('table')
    expect(within(table).getByText('Salaires')).toBeInTheDocument()
  })

  it('meilleurs produits : classement demandé au serveur', async () => {
    const { last } = setup()
    const { user } = renderApp('/reports?rapport=top-products', { session: manager })

    expect(await screen.findByText('Riz parfumé 25 kg')).toBeInTheDocument()
    await user.click(screen.getByText('Par marge'))
    await waitFor(() => expect(last('/api/reports/top-products')?.search.get('sortBy')).toBe('margin'))
  })
})
