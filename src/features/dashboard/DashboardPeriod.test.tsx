import { screen, waitFor, within } from '@testing-library/react'
import dayjs from 'dayjs'
import { http as mock, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { meResponse, shopsFixture } from '../../test/fixtures'
import { renderApp } from '../../test/render'
import { mockReportsApi } from '../../test/reportsApi'
import { server } from '../../test/server'
import { comparisonLabel, defaultSelection, periodBounds, periodTitle } from './period'

const manager = meResponse({ permissions: ['reports.view', 'stock.view'] })
const DAY = 'YYYY-MM-DD'

function setup() {
  server.use(mock.get('/api/shops', () => HttpResponse.json({ shops: shopsFixture })))
  return mockReportsApi()
}

describe('Périodes du tableau de bord', () => {
  const today = dayjs('2026-10-17')

  it('choix par défaut : hier, le mois dernier, les 7 derniers jours', () => {
    expect(defaultSelection('day', today)).toEqual({ mode: 'day', day: '2026-10-16' })
    expect(defaultSelection('month', today)).toEqual({ mode: 'month', month: '2026-09' })
    expect(defaultSelection('range', today)).toEqual({ mode: 'range', from: '2026-10-11', to: '2026-10-17' })
    expect(defaultSelection('today', today)).toEqual({ mode: 'today' })
  })

  it('bornes envoyées au serveur : un mois entier, le mois en cours arrêté à aujourd’hui', () => {
    expect(periodBounds({ mode: 'today' }, today)).toEqual({})
    expect(periodBounds({ mode: 'day', day: '2026-10-03' }, today)).toEqual({ from: '2026-10-03', to: '2026-10-03' })
    expect(periodBounds({ mode: 'month', month: '2026-02' }, today)).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(periodBounds({ mode: 'month', month: '2026-10' }, today)).toEqual({ from: '2026-10-01', to: '2026-10-17' })
    expect(periodBounds({ mode: 'range', from: '2026-09-10', to: '2026-10-02' }, today)).toEqual({ from: '2026-09-10', to: '2026-10-02' })
  })

  it('titres et libellés de comparaison en toutes lettres', () => {
    expect(periodTitle({ mode: 'day', day: '2026-10-03' })).toBe('Situation du 3 octobre 2026')
    expect(periodTitle({ mode: 'month', month: '2026-09' })).toBe('Situation de septembre 2026')
    expect(periodTitle({ mode: 'range', from: '2026-09-10', to: '2026-10-02' })).toBe('Situation du 10 septembre 2026 au 2 octobre 2026')

    expect(comparisonLabel({ mode: 'day', day: '2026-10-03' }, { from: '2026-10-02', to: '2026-10-02' })).toBe('vs veille')
    expect(comparisonLabel({ mode: 'month', month: '2026-09' }, { from: '2026-08-01', to: '2026-08-31' })).toBe('vs août 2026')
    // Mois en cours (incomplet) : le serveur compare aux jours juste avant
    expect(comparisonLabel({ mode: 'month', month: '2026-10' }, { from: '2026-09-14', to: '2026-09-30' })).toBe('vs 14/09 – 30/09')
    expect(comparisonLabel({ mode: 'range', from: '2026-10-11', to: '2026-10-17' }, { from: '2026-10-04', to: '2026-10-10' })).toBe('vs 04/10 – 10/10')
  })
})

describe('Tableau de bord sur une période passée', () => {
  it('un jour : chiffres du jour comparés à la veille, top produits de la période, stock à l’instant', async () => {
    const { last } = setup()
    const { user } = renderApp('/', { session: manager })
    await screen.findByText('Chiffre d’affaires du jour')

    await user.click(screen.getByText('Jour'))

    const yesterday = dayjs().subtract(1, 'day').format(DAY)
    await waitFor(() => expect(last('/api/reports/dashboard')?.search.get('from')).toBe(yesterday))
    expect(last('/api/reports/dashboard')?.search.get('to')).toBe(yesterday)
    expect(await screen.findByText('Chiffre d’affaires net')).toBeInTheDocument()
    expect(screen.getByText(periodTitle({ mode: 'day', day: yesterday }))).toBeInTheDocument()
    // 900 000 contre 600 000 : +50 %, en toutes lettres
    expect(screen.getAllByText(/\+50 % vs veille/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Situation actuelle (stock, créances, caisses)')).toBeInTheDocument()
    expect(screen.getByText('3 500 000 FCFA')).toBeInTheDocument()
    const top = screen.getByText('Meilleurs produits de la période').closest('.ant-card') as HTMLElement
    expect(within(top).getByText('Huile 5 L')).toBeInTheDocument()
    expect(screen.getByText('Chiffre d’affaires net — par jour')).toBeInTheDocument()
  })

  it('un mois : du 1er au dernier jour, comparé au mois précédent', async () => {
    const { last } = setup()
    const { user } = renderApp('/', { session: manager })
    await screen.findByText('Chiffre d’affaires du jour')

    await user.click(screen.getByText('Mois'))

    const month = dayjs().subtract(1, 'month')
    await waitFor(() => expect(last('/api/reports/dashboard')?.search.get('from')).toBe(month.startOf('month').format(DAY)))
    expect(last('/api/reports/dashboard')?.search.get('to')).toBe(month.endOf('month').format(DAY))
    const before = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(month.subtract(1, 'month').toDate())
    expect((await screen.findAllByText(new RegExp(`\\+50 % vs ${before}`))).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(periodTitle({ mode: 'month', month: month.format('YYYY-MM') }))).toBeInTheDocument()
  })

  it('une période libre : les 7 derniers jours par défaut, graphique par jour et sa vue tableau', async () => {
    const { last } = setup()
    const { user } = renderApp('/', { session: manager })
    await screen.findByText('Chiffre d’affaires du jour')

    await user.click(screen.getByText('Période'))

    await waitFor(() => expect(last('/api/reports/dashboard')?.search.get('from')).toBe(dayjs().subtract(6, 'day').format(DAY)))
    expect(last('/api/reports/dashboard')?.search.get('to')).toBe(dayjs().format(DAY))
    await screen.findByText('Chiffre d’affaires net — par jour')
    await user.click(screen.getAllByTitle('Tableau')[0]!)
    // 7 points : 1 000 à 7 000
    expect(await screen.findByText('7 000 FCFA')).toBeInTheDocument()
  })

  it('une date saisie au clavier, puis retour à aujourd’hui sans période', async () => {
    const { last } = setup()
    const { user } = renderApp('/', { session: manager })
    await screen.findByText('Chiffre d’affaires du jour')

    await user.click(screen.getByText('Jour'))
    const input = await screen.findByLabelText('Date')
    const day = dayjs().subtract(10, 'day')
    await user.clear(input)
    await user.type(input, `${day.format('DD/MM/YYYY')}{Enter}`)
    await waitFor(() => expect(last('/api/reports/dashboard')?.search.get('from')).toBe(day.format(DAY)))

    await user.click(screen.getByText('Aujourd’hui'))
    // Vue du jour reprise du cache (aucune nouvelle requête) : plus de mention « situation actuelle »
    expect(await screen.findByText('Chiffre d’affaires du jour')).toBeInTheDocument()
    expect(screen.queryByText('Situation actuelle (stock, créances, caisses)')).not.toBeInTheDocument()
    expect(screen.getByText('Chiffre d’affaires net — 7 derniers jours')).toBeInTheDocument()
  })

  it('la boutique choisie en haut de page s’ajoute à la période, sans la réinitialiser', async () => {
    const { last } = setup()
    const { user } = renderApp('/', { session: manager })
    await screen.findByText('Chiffre d’affaires du jour')

    await user.click(screen.getByText('Mois'))
    await user.click(await screen.findByLabelText('Boutique active'))
    await user.click(await screen.findByTitle('Boutique Marché'))

    await waitFor(() => expect(last('/api/reports/dashboard')?.search.get('shopId')).toBe('shop-2'))
    expect(last('/api/reports/dashboard')?.search.get('from')).toBe(dayjs().subtract(1, 'month').startOf('month').format(DAY))
  })
})
