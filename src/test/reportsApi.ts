import { http as mock, HttpResponse } from 'msw'
import type { Dashboard, SalesFigures } from '../types/reports'
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

export const dashboardFixture: Dashboard = {
  date: '2026-10-16',
  currency: 'XOF',
  timezone: 'Africa/Abidjan',
  today: figures('150000.00', { salesCount: 12, averageBasket: '12500.00' }),
  yesterday: figures('100000.00'),
  month: { ...figures('2400000.00', { grossMargin: '600000.00', marginRate: '25.0' }), from: '2026-10-01', expenses: '650000.00', netResult: '-50000.00' },
  last7Days: ['10', '11', '12', '13', '14', '15', '16'].map((day, index) => ({ date: `2026-10-${day}`, salesCount: index, netRevenue: `${(index + 1) * 10000}.00` })),
  topProducts: [{ productId: 'p-rice', sku: 'RIZ-25', name: 'Riz parfumé 25 kg', unit: 'pce', quantity: '40.000', salesCount: 30, revenue: '600000.00', cost: '480000.00', grossMargin: '120000.00', marginRate: '20.0' }],
  stock: { value: '3500000.00', lowStockCount: 3, outOfStockCount: 1 },
  customers: { debtorsCount: 2, totalDebt: '85000.00' },
  openCashSessions: 1,
}

/** Fausse API des rapports ; journalise les paramètres, et peut refuser un export. */
export function mockReportsApi(options: { failExport?: boolean } = {}) {
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
    mock.get('/api/reports/dashboard', ({ request }) => {
      record(request)
      return HttpResponse.json({ dashboard: dashboardFixture })
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
