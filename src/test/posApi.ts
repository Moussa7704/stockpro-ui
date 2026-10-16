import { http as mock, HttpResponse } from 'msw'
import type { CashSession, Customer, Sale, SaleInput } from '../types/pos'
import { server } from './server'
import { stockProducts } from './stockApi'

const now = () => new Date().toISOString()

export const cashMethod = { id: 'pm-cash', code: 'cash', name: 'Espèces', type: 'cash' as const, active: true, sortOrder: 1 }
export const mobileMethod = { id: 'pm-momo', code: 'mobile_money', name: 'Mobile Money', type: 'mobile_money' as const, active: true, sortOrder: 2 }

/**
 * Fausse API de la caisse (avec état), à combiner avec mockStockApi() (boutiques, produits, scan).
 * Comme le serveur : une vente renvoyée avec une clé d'idempotence déjà vue n'est pas recréée.
 */
export function mockPosApi(options: { sessionOpen?: boolean; maxCashierDiscountPercent?: number; failFirstSale?: boolean } = {}) {
  let saleFailures = options.failFirstSale ? 1 : 0
  const session: CashSession = {
    id: 'cs-1',
    shopId: 'shop-1',
    cashierId: 'user-1',
    status: 'open',
    openedAt: '2026-10-16T08:00:00.000Z',
    openingFloat: '10000.00',
    closedAt: null,
    expectedCash: null,
    countedCash: null,
    difference: null,
    notes: null,
  }
  const customers: Customer[] = [{ id: 'cu-1', name: 'Awa Ndiaye', phone: '+221770000001', email: null, creditLimit: '50000.00', balance: '0.00', archivedAt: null }]
  const db = {
    session: options.sessionOpen === false ? null : session,
    sales: [] as Sale[],
    salesByKey: new Map<string, Sale>(),
    requests: [] as { method: string; path: string; body: unknown; idempotencyKey: string | null }[],
  }
  const record = async (request: Request) => {
    db.requests.push({
      method: request.method,
      path: new URL(request.url).pathname,
      body: await request.clone().json().catch(() => null),
      idempotencyKey: request.headers.get('Idempotency-Key'),
    })
  }
  const requestsTo = (method: string, path: string) => db.requests.filter((item) => item.method === method && item.path === path)
  const summary = () => {
    const cash = db.sales.filter((sale) => sale.status === 'completed').reduce((sum, sale) => sum + Number(sale.amountPaid), 0)
    return {
      salesCount: db.sales.length,
      salesTotal: cash.toFixed(2),
      byMethod: [{ methodId: cashMethod.id, name: 'Espèces', type: 'cash', amount: cash.toFixed(2) }],
      cashRefunds: '0.00',
      customerPayments: '0.00',
      cashCustomerPayments: '0.00',
      cashExpenses: '0.00',
      expectedCash: (10000 + cash).toFixed(2),
    }
  }

  server.use(
    mock.get('/api/company', () =>
      HttpResponse.json({
        company: { id: 'company-1', name: 'Commerce 1', slug: 'commerce-1', currency: 'XOF', timezone: 'Africa/Abidjan', status: 'active', settings: { maxCashierDiscountPercent: options.maxCashierDiscountPercent ?? 10 }, createdAt: now(), updatedAt: now() },
      }),
    ),
    mock.get('/api/payment-methods', () => HttpResponse.json({ paymentMethods: [cashMethod, mobileMethod] })),
    mock.get('/api/pos/sessions/current', () => HttpResponse.json({ session: db.session && { ...db.session, summary: summary() } })),
    mock.post('/api/pos/sessions', async ({ request }) => {
      await record(request)
      const body = (await request.json()) as { openingFloat: string }
      db.session = { ...session, openingFloat: body.openingFloat }
      return HttpResponse.json({ session: db.session }, { status: 201 })
    }),
    mock.get('/api/pos/sessions/:id', () => HttpResponse.json({ session: { ...db.session, summary: summary() } })),
    mock.post('/api/pos/sessions/:id/close', async ({ request }) => {
      await record(request)
      const body = (await request.json()) as { countedCash: string }
      const expected = Number(summary().expectedCash)
      const closed = { ...db.session!, status: 'closed' as const, countedCash: body.countedCash, expectedCash: expected.toFixed(2), difference: (Number(body.countedCash) - expected).toFixed(2) }
      db.session = null
      return HttpResponse.json({ session: closed })
    }),
    mock.post('/api/pos/sales', async ({ request }) => {
      await record(request)
      const key = request.headers.get('Idempotency-Key')!
      if (saleFailures > 0) {
        saleFailures -= 1
        return HttpResponse.error()
      }
      // Clé déjà vue : même vente, rien n'est refait (comportement du serveur)
      const replay = db.salesByKey.get(key)
      if (replay) return HttpResponse.json({ sale: replay }, { status: 201 })
      const body = (await request.json()) as SaleInput
      const total = body.lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unitPrice ?? stockProducts.rice.salePrice), 0)
      const paid = body.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
      const sale: Sale = {
        id: `sale-${db.sales.length + 1}`,
        shopId: body.shopId,
        cashSessionId: 'cs-1',
        number: `BTQ1-T-2026-00000${db.sales.length + 1}`,
        status: 'completed',
        subtotal: total.toFixed(2),
        discountTotal: '0.00',
        total: total.toFixed(2),
        amountPaid: Math.min(paid, total).toFixed(2),
        changeGiven: Math.max(0, paid - total).toFixed(2),
        balanceDue: Math.max(0, total - paid).toFixed(2),
        notes: null,
        createdBy: 'user-1',
        cancelReason: null,
        createdAt: now(),
        customer: body.customerId ? { id: body.customerId, name: 'Awa Ndiaye' } : null,
        lines: body.lines.map((line, index) => ({
          id: `sl-${index}`,
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: stockProducts.rice.salePrice,
          discount: '0.00',
          lineTotal: (Number(line.quantity) * Number(stockProducts.rice.salePrice)).toFixed(2),
          returnedQuantity: '0.000',
          product: { id: line.productId, sku: 'RIZ-25', name: 'Riz parfumé 25 kg', barcode: null },
        })),
        payments: body.payments.map((payment, index) => ({ id: `sp-${index}`, amount: payment.amount, reference: null, paymentMethod: { ...cashMethod } })),
      }
      db.sales.push(sale)
      db.salesByKey.set(key, sale)
      return HttpResponse.json({ sale }, { status: 201 })
    }),
    mock.get('/api/pos/sales', () => HttpResponse.json({ items: db.sales, total: db.sales.length, page: 1, pageSize: 20 })),
    mock.get('/api/pos/sales/:id', ({ params }) => HttpResponse.json({ sale: db.sales.find((sale) => sale.id === params.id) })),
    mock.get('/api/pos/sales/:id/ticket', ({ params }) => {
      const sale = db.sales.find((item) => item.id === params.id)!
      return HttpResponse.json({ ticket: { number: sale.number, status: sale.status, total: sale.total, changeGiven: sale.changeGiven, balanceDue: sale.balanceDue, text: `Ticket ${sale.number}\nTOTAL FCFA ${sale.total}` } })
    }),
    mock.post('/api/pos/sales/:id/cancel', async ({ request, params }) => {
      await record(request)
      const body = (await request.json()) as { reason: string }
      db.sales = db.sales.map((sale) => (sale.id === params.id ? { ...sale, status: 'cancelled', cancelReason: body.reason } : sale))
      return HttpResponse.json({ sale: db.sales.find((sale) => sale.id === params.id) })
    }),
    mock.post('/api/pos/returns', async ({ request }) => {
      await record(request)
      return HttpResponse.json({ return: { id: 'ret-1', number: 'BTQ1-RT-2026-000001', refundAmount: '1500.00' } }, { status: 201 })
    }),
    mock.get('/api/customers', ({ request }) => {
      const search = new URL(request.url).searchParams.get('search')?.toLowerCase() ?? ''
      const items = customers.filter((customer) => customer.name.toLowerCase().includes(search) || (customer.phone ?? '').includes(search))
      return HttpResponse.json({ items, total: items.length, page: 1, pageSize: 10 })
    }),
  )
  return { db, requestsTo }
}

/** Vente enregistrée directement (pour les tests de l'historique). */
export function seedSale(db: ReturnType<typeof mockPosApi>['db'], overrides: Partial<Sale> = {}) {
  const sale: Sale = {
    id: 'sale-seed',
    shopId: 'shop-1',
    cashSessionId: 'cs-1',
    number: 'BTQ1-T-2026-000042',
    status: 'completed',
    subtotal: '3000.00',
    discountTotal: '0.00',
    total: '3000.00',
    amountPaid: '3000.00',
    changeGiven: '0.00',
    balanceDue: '0.00',
    notes: null,
    createdBy: 'user-1',
    cancelReason: null,
    createdAt: now(),
    customer: null,
    lines: [{ id: 'sl-seed', productId: 'p-rice', quantity: '2.000', unitPrice: '1500.00', discount: '0.00', lineTotal: '3000.00', returnedQuantity: '0.000', product: { id: 'p-rice', sku: 'RIZ-25', name: 'Riz parfumé 25 kg', barcode: null } }],
    payments: [{ id: 'sp-seed', amount: '3000.00', reference: null, paymentMethod: { id: cashMethod.id, code: 'cash', name: 'Espèces', type: 'cash' } }],
    ...overrides,
  }
  db.sales.push(sale)
  return sale
}
