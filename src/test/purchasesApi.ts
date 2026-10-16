import { http as mock, HttpResponse } from 'msw'
import type { GoodsReceipt, PurchaseOrder, SupplierInvoice, SupplierReturn } from '../types/purchases'
import { server } from './server'
import { stockProducts } from './stockApi'

const ref = (product: { id: string; sku: string; name: string }) => ({ id: product.id, sku: product.sku, name: product.name })
const now = () => new Date().toISOString()
const page = <T,>(items: T[]) => ({ items, total: items.length, page: 1, pageSize: 20 })

/**
 * Fausse API des achats (avec état), à utiliser avec mockStockApi() qui fournit boutiques et
 * produits. Les requêtes sont journalisées avec leurs en-têtes (clé d'idempotence).
 */
export function mockPurchasesApi(options: { failFirstValidation?: boolean } = {}) {
  let validationFailures = options.failFirstValidation ? 1 : 0
  const supplier = { id: 'sup-1', name: 'Grossiste du port' }
  const db = {
    orders: [
      {
        id: 'po-sent',
        shopId: 'shop-1',
        supplierId: supplier.id,
        number: 'BTQ1-BC-2026-000007',
        status: 'sent',
        expectedAt: '2026-10-20',
        notes: null,
        total: '125000.00',
        sentAt: now(),
        closedAt: null,
        createdAt: now(),
        supplier,
        lines: [
          { id: 'pol-1', productId: 'p-rice', quantityOrdered: '10.000', quantityReceived: '0.000', quantityRemaining: '10.000', unitCost: '12500.00', lineTotal: '125000.00', product: ref(stockProducts.rice) },
        ],
      },
    ] as PurchaseOrder[],
    receipts: [] as GoodsReceipt[],
    returns: [] as SupplierReturn[],
    invoices: [
      {
        id: 'inv-1',
        supplierId: supplier.id,
        receiptId: null,
        reference: 'FA-0451',
        invoiceDate: '2026-09-01',
        dueDate: '2026-09-30',
        total: '100000.00',
        amountPaid: '40000.00',
        remaining: '60000.00',
        overdue: true,
        status: 'partially_paid',
        notes: null,
        createdAt: now(),
        supplier,
        payments: [{ id: 'pay-1', amount: '40000.00', method: 'cash', paidAt: '2026-09-05', reference: null, notes: null, createdAt: now() }],
      },
    ] as SupplierInvoice[],
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
  const lastRequest = (method: string, path: string) => requestsTo(method, path).at(-1)

  server.use(
    mock.get('/api/suppliers', () => HttpResponse.json(page([{ ...supplier, contactName: null, phone: null, email: null, address: null, notes: null, archivedAt: null, createdAt: now() }]))),
    // --- Commandes
    mock.get('/api/purchases/orders', () => HttpResponse.json(page(db.orders))),
    mock.get('/api/purchases/orders/:id', ({ params }) => HttpResponse.json({ order: db.orders.find((order) => order.id === params.id) })),
    mock.post('/api/purchases/orders', async ({ request }) => {
      await record(request)
      const body = (await request.json()) as { shopId: string; supplierId: string; lines: { productId: string; quantity: string; unitCost: string }[] }
      const order: PurchaseOrder = {
        id: 'po-new',
        shopId: body.shopId,
        supplierId: body.supplierId,
        number: 'BTQ1-BC-2026-000008',
        status: 'draft',
        expectedAt: null,
        notes: null,
        total: '0.00',
        sentAt: null,
        closedAt: null,
        createdAt: now(),
        supplier,
        lines: body.lines.map((line, index) => ({
          id: `pol-new-${index}`,
          productId: line.productId,
          quantityOrdered: line.quantity,
          quantityReceived: '0.000',
          quantityRemaining: line.quantity,
          unitCost: line.unitCost,
          lineTotal: String(Number(line.quantity) * Number(line.unitCost)),
          product: ref(stockProducts.rice),
        })),
      }
      db.orders.push(order)
      return HttpResponse.json({ order }, { status: 201 })
    }),
    mock.post('/api/purchases/orders/:id/:action', async ({ request, params }) => {
      await record(request)
      const next = { send: 'sent', cancel: 'cancelled', close: 'closed' }[params.action as string] as PurchaseOrder['status']
      db.orders = db.orders.map((order) => (order.id === params.id ? { ...order, status: next } : order))
      return HttpResponse.json({ order: db.orders.find((order) => order.id === params.id) })
    }),
    // --- Réceptions
    mock.get('/api/purchases/receipts', () => HttpResponse.json(page(db.receipts))),
    mock.get('/api/purchases/receipts/:id', ({ params }) => HttpResponse.json({ receipt: db.receipts.find((receipt) => receipt.id === params.id) })),
    mock.post('/api/purchases/receipts', async ({ request }) => {
      await record(request)
      const body = (await request.json()) as GoodsReceipt
      const receipt = { ...body, id: `rec-${db.receipts.length + 1}`, number: `BTQ1-REC-2026-00000${db.receipts.length + 1}`, status: 'draft', total: '0.00', validatedAt: null, createdAt: now(), orderId: body.orderId ?? null, supplierReference: body.supplierReference ?? null, notes: null, lines: [] } as GoodsReceipt
      db.receipts.push(receipt)
      return HttpResponse.json({ receipt }, { status: 201 })
    }),
    mock.post('/api/purchases/receipts/:id/validate', async ({ request, params }) => {
      await record(request)
      // Simule une coupure : la première validation échoue
      if (validationFailures > 0) {
        validationFailures -= 1
        return HttpResponse.error()
      }
      db.receipts = db.receipts.map((receipt) => (receipt.id === params.id ? { ...receipt, status: 'validated', validatedAt: now() } : receipt))
      return HttpResponse.json({ receipt: db.receipts.find((receipt) => receipt.id === params.id) })
    }),
    // --- Retours
    mock.get('/api/purchases/returns', () => HttpResponse.json(page(db.returns))),
    mock.get('/api/purchases/returns/:id', ({ params }) => HttpResponse.json({ return: db.returns.find((item) => item.id === params.id) })),
    mock.post('/api/purchases/returns', async ({ request }) => {
      await record(request)
      const body = (await request.json()) as SupplierReturn & { lines: { productId: string; quantity: string }[] }
      const created: SupplierReturn = {
        ...body,
        id: 'ret-1',
        number: 'BTQ1-RF-2026-000001',
        status: 'draft',
        receiptId: null,
        notes: null,
        total: '0.00',
        validatedAt: null,
        createdAt: now(),
        lines: body.lines.map((line, index) => ({ id: `rl-${index}`, productId: line.productId, quantity: line.quantity, unitCost: null, lineTotal: null, product: ref(stockProducts.sugar) })),
      }
      db.returns.push(created)
      return HttpResponse.json({ return: created }, { status: 201 })
    }),
    mock.post('/api/purchases/returns/:id/validate', async ({ request, params }) => {
      await record(request)
      db.returns = db.returns.map((item) => (item.id === params.id ? { ...item, status: 'validated', validatedAt: now() } : item))
      return HttpResponse.json({ return: db.returns.find((item) => item.id === params.id) })
    }),
    // --- Factures
    mock.get('/api/purchases/invoices', () => HttpResponse.json(page(db.invoices))),
    mock.get('/api/purchases/invoices/:id', ({ params }) => HttpResponse.json({ invoice: db.invoices.find((invoice) => invoice.id === params.id) })),
    mock.post('/api/purchases/invoices', async ({ request }) => {
      await record(request)
      const body = (await request.json()) as SupplierInvoice
      const invoice: SupplierInvoice = { ...body, id: 'inv-new', receiptId: null, amountPaid: '0.00', remaining: body.total, overdue: false, status: 'unpaid', createdAt: now(), supplier, payments: [] }
      db.invoices.push(invoice)
      return HttpResponse.json({ invoice }, { status: 201 })
    }),
    mock.post('/api/purchases/invoices/:id/payments', async ({ request, params }) => {
      await record(request)
      const body = (await request.json()) as { amount: string; method: 'cash'; paidAt: string }
      db.invoices = db.invoices.map((invoice) => {
        if (invoice.id !== params.id) return invoice
        const paid = Number(invoice.amountPaid) + Number(body.amount)
        const remaining = Number(invoice.total) - paid
        return {
          ...invoice,
          amountPaid: paid.toFixed(2),
          remaining: remaining.toFixed(2),
          status: remaining === 0 ? 'paid' : 'partially_paid',
          overdue: remaining > 0 && invoice.overdue,
          payments: [...(invoice.payments ?? []), { id: `pay-${paid}`, amount: body.amount, method: body.method, paidAt: body.paidAt, reference: null, notes: null, createdAt: now() }],
        }
      })
      return HttpResponse.json({ invoice: db.invoices.find((invoice) => invoice.id === params.id) }, { status: 201 })
    }),
    mock.get('/api/purchases/supplier-balances', () =>
      HttpResponse.json({ balances: [{ supplier, invoiced: '100000.00', paid: '40000.00', outstanding: '60000.00', overdue: '60000.00', openInvoices: 1 }] }),
    ),
  )
  return { db, lastRequest, requestsTo }
}
