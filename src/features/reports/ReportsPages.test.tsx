import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { meResponse, shopsFixture } from '../../test/fixtures'
import { renderApp } from '../../test/render'
import { mockReportsApi } from '../../test/reportsApi'
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
    expect(screen.getByRole('link', { name: /3 en stock bas · 1 en rupture/ })).toHaveAttribute('href', '/stock')
    expect(screen.getByRole('link', { name: /2 client\(s\) débiteur\(s\)/ })).toHaveAttribute('href', '/debtors')
    expect(screen.getByText('Riz parfumé 25 kg')).toBeInTheDocument()
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

  it('filtre par boutique', async () => {
    const { last } = setup()
    const { user } = renderApp('/', { session: manager })

    await screen.findByText('150 000 FCFA')
    await user.click(screen.getByLabelText('Filtrer par boutique'))
    await user.click(await screen.findByTitle('Boutique Marché'))
    await waitFor(() => expect(last('/api/reports/dashboard')?.search.get('shopId')).toBe('shop-2'))
  })

  it('sans accès aux rapports : accueil avec raccourcis, aucune donnée financière demandée', async () => {
    const { requests } = setup()
    renderApp('/', { session: cashier })

    expect(await screen.findByRole('button', { name: /Ouvrir la caisse/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Clients/ })).toBeInTheDocument()
    expect(requests.some((request) => request.path === '/api/reports/dashboard')).toBe(false)
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
