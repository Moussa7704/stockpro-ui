import dayjs from 'dayjs'
import { http as mock, HttpResponse } from 'msw'
import type { Dashboard, PeriodFigures, SalesFigures } from '../types/reports'
import type { StockAlert } from '../types/stock'
import { server } from './server'

const figures = (netRevenue: string, overrides: Partial<SalesFigures> = {}): SalesFigures => ({
  salesCount: 10,
  grossSales: netRevenue,
  discounts: '0.00',
  revenue: netRevenue,
  refunds: '0.00',
  netRevenue,
  cost: '0.00',
  grossMargin: '0.00',
  marginRate: null,
  averageBasket: '0.00',
  ...overrides,
})

const periodFigures = (from: string, to: string, netRevenue: string, grossMargin: string, overrides: Partial<PeriodFigures> = {}): PeriodFigures => ({
  ...figures(netRevenue, { salesCount: 60, grossMargin, marginRate: '25.0', averageBasket: '15000.00', refunds: '20000.00', discounts: '5000.00' }),
  from,
  to,
  expenses: '100000.00',
  netResult: `${Number(grossMargin) - 100000}.00`,
  ...overrides,
})

/**
 * Période du tableau de bord, calculée comme le serveur : comparaison avec les mois précédents
 * pour des mois entiers, sinon autant de jours juste avant ; graphique par mois au-delà de 92 jours.
 */
export function periodFixture(from: string, to: string): Dashboard['period'] {
  const start = dayjs(from)
  const end = dayjs(to)
  const days = end.diff(start, 'day') + 1
  const wholeMonths = start.date() === 1 && end.date() === end.daysInMonth()
  const months = end.diff(start, 'month') + 1
  const previous = wholeMonths
    ? { from: start.subtract(months, 'month').format('YYYY-MM-DD'), to: start.subtract(1, 'day').format('YYYY-MM-DD') }
    : { from: start.subtract(days, 'day').format('YYYY-MM-DD'), to: start.subtract(1, 'day').format('YYYY-MM-DD') }
  const groupBy = days > 92 ? 'month' : 'day'
  const points = groupBy === 'day' ? Array.from({ length: days }, (_, index) => start.add(index, 'day')) : Array.from({ length: months }, (_, index) => start.startOf('month').add(index, 'month'))
  return {
    ...periodFigures(from, to, '900000.00', '225000.00'),
    days,
    previous: periodFigures(previous.from, previous.to, '600000.00', '150000.00'),
    groupBy,
    chart: points.map((point, index) => ({ period: point.format('YYYY-MM-DD'), salesCount: index, netRevenue: `${(index + 1) * 1000}.00` })),
  }
}

/** Meilleurs produits d'une période passée : différents de ceux du mois, pour vérifier qu'ils suivent la période. */
export const periodTopProducts = [{ productId: 'p-oil', sku: 'HUILE-5', name: 'Huile 5 L', unit: 'pce', quantity: '12.000', salesCount: 9, revenue: '96000.00', cost: '80000.00', grossMargin: '16000.00', marginRate: '16.7' }]

export const dashboardFixture: Dashboard = {
  date: '2026-10-16',
  currency: 'XOF',
  timezone: 'Africa/Abidjan',
  today: figures('150000.00', { salesCount: 12, averageBasket: '12500.00' }),
  yesterday: figures('100000.00'),
  month: { ...figures('2400000.00', { grossMargin: '600000.00', marginRate: '25.0' }), from: '2026-10-01', expenses: '650000.00', netResult: '-50000.00' },
  last7Days: ['10', '11', '12', '13', '14', '15', '16'].map((day, index) => ({ date: `2026-10-${day}`, salesCount: index, netRevenue: `${(index + 1) * 10000}.00` })),
  topProducts: [{ productId: 'p-rice', sku: 'RIZ-25', name: 'Riz parfumé 25 kg', unit: 'pce', quantity: '40.000', salesCount: 30, revenue: '600000.00', cost: '480000.00', grossMargin: '120000.00', marginRate: '20.0' }],
  period: periodFixture('2026-10-01', '2026-10-16'),
  stock: { value: '3500000.00', lowStockCount: 3, outOfStockCount: 1 },
  customers: { debtorsCount: 2, totalDebt: '85000.00' },
  openCashSessions: 1,
}

/** Alerte de stock pour la carte « À réapprovisionner » (ordre du serveur : ruptures d'abord). */
export function stockAlert(index: number, status: StockAlert['status'], overrides: Partial<StockAlert> = {}): StockAlert {
  return {
    shop: { id: 'shop-1', code: 'BTQ1', name: 'Boutique Centre' },
    product: { id: `p-${index}`, sku: `REF-${index}`, name: `Produit ${index}`, unit: 'pce' },
    quantity: status === 'out_of_stock' ? '0.000' : '2.000',
    alertThreshold: '5.000',
    status,
    ...overrides,
  }
}

export const alertsFixture: StockAlert[] = [
  stockAlert(1, 'out_of_stock', { product: { id: 'p-sugar', sku: 'SUCRE', name: 'Sucre en poudre', unit: 'kg' }, alertThreshold: '0.000' }),
  stockAlert(2, 'low_stock', { product: { id: 'p-rice', sku: 'RIZ-25', name: 'Riz parfumé 25 kg', unit: 'pce' }, quantity: '3.000' }),
]

/** Fausse API des rapports (et des alertes de stock du tableau de bord) ; journalise les paramètres, et peut refuser un export. */
export function mockReportsApi(options: { failExport?: boolean; alerts?: StockAlert[] } = {}) {
  const requests: { path: string; search: URLSearchParams }[] = []
  const record = (request: Request) => {
    const url = new URL(request.url)
    requests.push({ path: url.pathname, search: url.searchParams })
    return url.searchParams
  }
  const fileResponse = (params: URLSearchParams, name: string) => {
    if (options.failExport) return HttpResponse.json({ error: { message: 'Période limitée à deux ans' } }, { status: 400 })
    const format = params.get('format')!
    // Corps texte : le Blob de jsdom ne se lit pas en flux ; axios le reçoit quand même en fichier
    return new HttpResponse('fichier', {
      headers: { 'Content-Type': format === 'pdf' ? 'application/pdf' : 'application/vnd.ms-excel', 'Content-Disposition': `attachment; filename="${name}.${format}"` },
    })
  }

  server.use(
    mock.get('/api/stock/alerts', ({ request }) => {
      record(request)
      return HttpResponse.json({ alerts: options.alerts ?? alertsFixture })
    }),
    mock.get('/api/reports/dashboard', ({ request }) => {
      const params = record(request)
      const from = params.get('from')
      const to = params.get('to')
      if (!from || !to) return HttpResponse.json({ dashboard: dashboardFixture })
      return HttpResponse.json({ dashboard: { ...dashboardFixture, period: periodFixture(from, to), topProducts: periodTopProducts } })
    }),
    mock.get('/api/reports/sales', ({ request }) => {
      const params = record(request)
      if (params.get('format')) return fileResponse(params, `ventes_${params.get('from')}_${params.get('to')}`)
      return HttpResponse.json({
        report: {
          from: params.get('from'),
          to: params.get('to'),
          groupBy: params.get('groupBy'),
          currency: 'XOF',
          rows: [
            { period: '2026-10-15', ...figures('100000.00') },
            { period: '2026-10-16', ...figures('150000.00') },
          ],
          totals: figures('250000.00', { salesCount: 20, grossMargin: '62500.00', marginRate: '25.0', averageBasket: '12500.00' }),
        },
      })
    }),
    mock.get('/api/reports/top-products', ({ request }) => {
      const params = record(request)
      return HttpResponse.json({ report: { from: params.get('from'), to: params.get('to'), sortBy: params.get('sortBy'), items: dashboardFixture.topProducts } })
    }),
    mock.get('/api/reports/expenses', ({ request }) => {
      const params = record(request)
      return HttpResponse.json({
        report: { from: params.get('from'), to: params.get('to'), total: '570000.00', byCategory: [{ categoryId: 'c1', name: 'Salaires', count: 3, amount: '420000.00' }, { categoryId: 'c2', name: 'Loyer', count: 1, amount: '150000.00' }] },
      })
    }),
    mock.get('/api/reports/profit-and-loss', ({ request }) => {
      const params = record(request)
      return HttpResponse.json({
        report: {
          from: params.get('from'),
          to: params.get('to'),
          sales: figures('250000.00', { cost: '200000.00', grossMargin: '50000.00', marginRate: '20.0' }),
          expenses: { total: '70000.00', byCategory: [{ categoryId: 'c2', name: 'Loyer', count: 1, amount: '70000.00' }] },
          netResult: '-20000.00',
        },
      })
    }),
  )
  return { requests, last: (path: string) => [...requests].reverse().find((request) => request.path === path) }
}
