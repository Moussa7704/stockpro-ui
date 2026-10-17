import { http as mock, HttpResponse } from 'msw'
import type { Customer, CustomerDetail, CustomerPayment, Expense, ExpenseCategory } from '../types/customers'
import { cashMethod, mobileMethod } from './posApi'
import { server } from './server'

const now = () => new Date().toISOString()
const page = <T,>(items: T[]) => ({ items, total: items.length, page: 1, pageSize: 20 })

/**
 * Fausse API des clients et des dépenses (avec état), à combiner avec mockStockApi() pour les
 * boutiques. `sessionOpen` : ma caisse est-elle ouverte (espèces et paiement depuis le tiroir).
 */
export function mockCustomersApi(options: { sessionOpen?: boolean } = {}) {
  const customers: CustomerDetail[] = [
    {
      id: 'cu-awa',
      name: 'Awa Ndiaye',
      phone: '+221770000001',
      email: null,
      address: null,
      notes: null,
      creditLimit: '50000.00',
      balance: '30000.00',
      availableCredit: '20000.00',
      archivedAt: null,
      recentSales: [{ id: 's1', number: 'BTQ1-T-2026-000012', status: 'completed', total: '30000.00', balanceDue: '30000.00', createdAt: now() }],
    },
    { id: 'cu-ibra', name: 'Ibrahima Fall', phone: null, email: null, address: null, notes: null, creditLimit: null, balance: '0.00', availableCredit: '0.00', archivedAt: null, recentSales: [] },
  ]
  const db = {
    customers,
    categories: [
      { id: 'cat-rent', name: 'Loyer', archivedAt: null },
      { id: 'cat-power', name: 'Électricité et eau', archivedAt: null },
    ] as ExpenseCategory[],
    expenses: [] as Expense[],
    payments: [] as (CustomerPayment & { customerId: string })[],
    requests: [] as { method: string; path: string; search: string; body: unknown; idempotencyKey: string | null }[],
  }
  const record = async (request: Request) => {
    const url = new URL(request.url)
    db.requests.push({ method: request.method, path: url.pathname, search: url.search, body: await request.clone().json().catch(() => null), idempotencyKey: request.headers.get('Idempotency-Key') })
  }
  const lastRequest = (method: string, path: string) => [...db.requests].reverse().find((item) => item.method === method && item.path === path)

  server.use(
    mock.get('/api/payment-methods', () => HttpResponse.json({ paymentMethods: [cashMethod, mobileMethod] })),
    mock.get('/api/pos/sessions/current', () => HttpResponse.json({ session: options.sessionOpen ? { id: 'cs-1', shopId: 'shop-1', status: 'open' } : null })),
    // --- Clients
    mock.get('/api/customers', async ({ request }) => {
      await record(request)
      const params = new URL(request.url).searchParams
      const search = params.get('search')?.toLowerCase() ?? ''
      const withDebt = params.get('withDebt') === 'true'
      return HttpResponse.json(page(db.customers.filter((customer) => customer.name.toLowerCase().includes(search) && (!withDebt || Number(customer.balance) > 0))))
    }),
    mock.get('/api/customers/debtors', () =>
      HttpResponse.json({
        ...page([{ id: 'cu-awa', name: 'Awa Ndiaye', phone: '+221770000001', balance: '30000.00', creditLimit: '50000.00', archived: false, oldestUnpaidAt: '2026-06-01T10:00:00.000Z', aging: { current: '10000.00', days31To60: '0.00', days61To90: '0.00', over90: '20000.00' } }]),
        totalDebt: '30000.00',
      }),
    ),
    mock.get('/api/customers/:id', ({ params }) => HttpResponse.json({ customer: db.customers.find((customer) => customer.id === params.id) })),
    mock.post('/api/customers', async ({ request }) => {
      await record(request)
      const body = (await request.json()) as Customer
      const created = { ...body, id: 'cu-new', balance: '0.00', availableCredit: body.creditLimit ?? '0.00', archivedAt: null, address: null, notes: null, recentSales: [], creditLimit: body.creditLimit ?? null } as CustomerDetail
      db.customers.push(created)
      return HttpResponse.json({ customer: created }, { status: 201 })
    }),
    mock.get('/api/customers/:id/ledger', () =>
      HttpResponse.json(page([{ id: 'l1', type: 'sale_credit', amount: '30000.00', balanceAfter: '30000.00', sourceType: 'sale', sourceId: 's1', createdAt: now() }])),
    ),
    mock.get('/api/customers/:id/statement', async ({ request }) => {
      await record(request)
      const params = new URL(request.url).searchParams
      return HttpResponse.json({
        statement: {
          customer: { id: 'cu-awa', name: 'Awa Ndiaye', phone: '+221770000001', email: null },
          currency: 'XOF',
          timezone: 'Africa/Abidjan',
          from: params.get('from'),
          to: params.get('to'),
          openingBalance: '5000.00',
          totalDebits: '30000.00',
          totalCredits: '5000.00',
          closingBalance: '30000.00',
          entries: [{ id: 'e1', date: now(), type: 'sale_credit', reference: 'BTQ1-T-2026-000012', debit: '30000.00', credit: '0.00', balance: '35000.00' }],
        },
      })
    }),
    mock.get('/api/customers/:id/payments', ({ params }) => HttpResponse.json(page(db.payments.filter((payment) => payment.customerId === params.id)))),
    // Reçu : le règlement avec la dette ACTUELLE du client
    mock.get('/api/customers/payments/:id', ({ params }) => {
      const payment = db.payments.find((item) => item.id === params.id)
      if (!payment) return HttpResponse.json({ error: { message: 'Règlement introuvable' } }, { status: 404 })
      return HttpResponse.json({ payment: { ...payment, customerBalance: db.customers.find((item) => item.id === payment.customerId)!.balance } })
    }),
    mock.post('/api/customers/:id/payments', async ({ request, params }) => {
      await record(request)
      const body = (await request.json()) as { amount: string; shopId: string; paymentMethodId: string; reference: string | null }
      const customer = db.customers.find((item) => item.id === params.id)!
      customer.balance = (Number(customer.balance) - Number(body.amount)).toFixed(2)
      const method = [cashMethod, mobileMethod].find((item) => item.id === body.paymentMethodId)
      const payment = {
        id: `9f3c2a1b-0000-4000-8000-00000000000${db.payments.length + 1}`,
        customerId: customer.id,
        shopId: body.shopId,
        amount: body.amount,
        reference: body.reference,
        cashSessionId: null,
        createdAt: now(),
        ...(method && { paymentMethod: { id: method.id, code: method.code, name: method.name, type: method.type } }),
      }
      db.payments.unshift(payment)
      return HttpResponse.json({ payment: { ...payment, customerBalance: customer.balance } }, { status: 201 })
    }),
    // --- Dépenses
    mock.get('/api/expenses/categories', () => HttpResponse.json({ categories: db.categories })),
    mock.post('/api/expenses/categories', async ({ request }) => {
      await record(request)
      const category = { id: `cat-${db.categories.length + 1}`, name: ((await request.json()) as { name: string }).name, archivedAt: null }
      db.categories.push(category)
      return HttpResponse.json({ category }, { status: 201 })
    }),
    mock.get('/api/expenses', async ({ request }) => {
      await record(request)
      const recorded = db.expenses.filter((expense) => expense.status === 'recorded')
      return HttpResponse.json({ ...page(db.expenses), totalAmount: recorded.reduce((sum, expense) => sum + Number(expense.amount), 0).toFixed(2) })
    }),
    mock.post('/api/expenses', async ({ request }) => {
      await record(request)
      const body = (await request.json()) as Expense
      const expense: Expense = {
        ...body,
        id: `exp-${db.expenses.length + 1}`,
        number: `BTQ1-DEP-2026-00000${db.expenses.length + 1}`,
        status: 'recorded',
        cancelReason: null,
        createdAt: now(),
        supplierId: null,
        cashSessionId: body.cashSessionId ?? null,
        category: db.categories.find((category) => category.id === body.categoryId),
        paymentMethod: { ...cashMethod },
      }
      db.expenses.push(expense)
      return HttpResponse.json({ expense }, { status: 201 })
    }),
    mock.post('/api/expenses/:id/cancel', async ({ request, params }) => {
      await record(request)
      const body = (await request.json()) as { reason: string }
      db.expenses = db.expenses.map((expense) => (expense.id === params.id ? { ...expense, status: 'cancelled', cancelReason: body.reason } : expense))
      return HttpResponse.json({ expense: db.expenses.find((expense) => expense.id === params.id) })
    }),
  )
  return { db, lastRequest }
}
