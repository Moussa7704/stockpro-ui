import { http as mock, HttpResponse } from 'msw'
import type { Product } from '../types/catalog'
import type { InventoryCount, StockAdjustment, StockLevel, StockMovement, StockTransfer } from '../types/stock'
import { shopsFixture } from './fixtures'
import { server } from './server'

const unitPiece = { id: 'u-pce', name: 'Pièce', symbol: 'pce', allowsDecimal: false }
const unitKg = { id: 'u-kg', name: 'Kilogramme', symbol: 'kg', allowsDecimal: true }

function product(id: string, name: string, sku: string, barcode: string | null, unit = unitPiece, purchasePriceHint: string | null = null): Product {
  return {
    id,
    sku,
    barcode,
    name,
    description: null,
    categoryId: null,
    unitId: unit.id,
    salePrice: '1500.00',
    purchasePriceHint,
    alertThreshold: '5',
    status: 'active',
    unit,
    category: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  }
}

export const stockProducts = {
  rice: product('p-rice', 'Riz parfumé 25 kg', 'RIZ-25', '6001234567890', unitPiece, '12500.00'),
  sugar: product('p-sugar', 'Sucre en poudre', 'SUCRE', null, unitKg),
}

const ref = (item: Product) => ({ id: item.id, sku: item.sku, name: item.name })

/**
 * Fausse API du stock (avec état) : niveaux, alertes, mouvements, documents, et la recherche /
 * le scan de produits utilisés par le sélecteur de produits.
 */
export function mockStockApi(options: { withCosts?: boolean } = {}) {
  const withCosts = options.withCosts ?? true
  const db = {
    levels: [
      {
        shop: { id: 'shop-1', code: 'BTQ1', name: 'Boutique Centre' },
        product: { ...ref(stockProducts.rice), barcode: stockProducts.rice.barcode, unit: 'pce' },
        quantity: '3.000',
        alertThreshold: '5.000',
        lowStock: true,
        ...(withCosts && { averageCost: '12000.0000', stockValue: '36000.00' }),
      },
      {
        shop: { id: 'shop-1', code: 'BTQ1', name: 'Boutique Centre' },
        product: { ...ref(stockProducts.sugar), barcode: null, unit: 'kg' },
        quantity: '42.500',
        alertThreshold: '0.000',
        lowStock: false,
        ...(withCosts && { averageCost: '600.0000', stockValue: '25500.00' }),
      },
    ] as StockLevel[],
    movements: [
      { id: 'mv1', shopId: 'shop-1', productId: 'p-rice', type: 'sale', quantity: '-2.000', balanceAfter: '3.000', sourceType: 'sale', sourceId: 's1', createdAt: '2026-10-16T09:00:00.000Z', product: ref(stockProducts.rice) },
      { id: 'mv2', shopId: 'shop-1', productId: 'p-rice', type: 'adjustment', quantity: '5.000', balanceAfter: '5.000', sourceType: 'stock_adjustment', sourceId: 'a1', createdAt: '2026-10-15T09:00:00.000Z', product: ref(stockProducts.rice) },
    ] as StockMovement[],
    adjustments: [] as StockAdjustment[],
    transfers: [] as StockTransfer[],
    inventories: [] as InventoryCount[],
    requests: [] as { method: string; path: string; search: string; body: unknown }[],
  }
  const record = async (request: Request) => {
    const url = new URL(request.url)
    db.requests.push({ method: request.method, path: url.pathname, search: url.search, body: await request.clone().json().catch(() => null) })
  }
  const lastRequest = (method: string, path: string) => [...db.requests].reverse().find((item) => item.method === method && item.path === path)
  const page = <T,>(items: T[]) => ({ items, total: items.length, page: 1, pageSize: 20 })
  const products = Object.values(stockProducts)

  server.use(
    mock.get('/api/shops', () => HttpResponse.json({ shops: shopsFixture })),
    // Sélecteur de produits : recherche et scan
    mock.get('/api/products', ({ request }) => {
      const search = new URL(request.url).searchParams.get('search')?.toLowerCase() ?? ''
      return HttpResponse.json(page(products.filter((item) => `${item.name} ${item.sku}`.toLowerCase().includes(search))))
    }),
    mock.get('/api/products/lookup', ({ request }) => {
      const params = new URL(request.url).searchParams
      const found = products.find((item) => (params.get('barcode') ? item.barcode === params.get('barcode') : item.sku === params.get('sku')))
      return found ? HttpResponse.json({ product: found }) : HttpResponse.json({ error: { message: 'Produit introuvable' } }, { status: 404 })
    }),
    mock.get('/api/stock', async ({ request }) => {
      await record(request)
      const lowStock = new URL(request.url).searchParams.get('lowStock') === 'true'
      return HttpResponse.json(page(db.levels.filter((level) => !lowStock || level.lowStock)))
    }),
    mock.get('/api/stock/alerts', () =>
      HttpResponse.json({
        alerts: db.levels.filter((level) => level.lowStock).map((level) => ({ shop: { id: level.shop.id, code: level.shop.code }, product: ref(stockProducts.rice), quantity: level.quantity, alertThreshold: level.alertThreshold })),
      }),
    ),
    mock.get('/api/stock/movements', async ({ request }) => {
      await record(request)
      const productId = new URL(request.url).searchParams.get('productId')
      return HttpResponse.json(page(db.movements.filter((movement) => !productId || movement.productId === productId)))
    }),
    mock.get('/api/stock/adjustments', () => HttpResponse.json(page(db.adjustments))),
    mock.post('/api/stock/adjustments', async ({ request }) => {
      await record(request)
      const body = (await request.json()) as StockAdjustment
      const adjustment = { ...body, id: 'adj-1', number: 'BTQ1-AJ-2026-000001', notes: null, createdBy: 'user-1', createdAt: new Date().toISOString() }
      db.adjustments.push(adjustment)
      return HttpResponse.json({ adjustment }, { status: 201 })
    }),
    mock.get('/api/stock/transfers', () => HttpResponse.json(page(db.transfers))),
    mock.get('/api/stock/transfers/:id', ({ params }) => HttpResponse.json({ transfer: db.transfers.find((item) => item.id === params.id) })),
    mock.post('/api/stock/transfers', async ({ request }) => {
      await record(request)
      const body = (await request.json()) as { fromShopId: string; toShopId: string; lines: { productId: string; quantity: string }[] }
      const transfer: StockTransfer = {
        id: 'tr-1',
        number: 'BTQ1-TR-2026-000001',
        fromShopId: body.fromShopId,
        toShopId: body.toShopId,
        status: 'draft',
        notes: null,
        createdBy: 'user-1',
        shippedAt: null,
        receivedAt: null,
        createdAt: new Date().toISOString(),
        lines: body.lines.map((line, index) => ({ id: `tl-${index + 1}`, productId: line.productId, quantitySent: line.quantity, quantityReceived: null, product: ref(products.find((item) => item.id === line.productId)!) })),
      }
      db.transfers.push(transfer)
      return HttpResponse.json({ transfer }, { status: 201 })
    }),
    mock.post('/api/stock/transfers/:id/:action', async ({ request, params }) => {
      await record(request)
      const body = (await request.json().catch(() => ({}))) as { lines?: { lineId: string; quantityReceived: string }[] }
      db.transfers = db.transfers.map((item) => {
        if (item.id !== params.id) return item
        if (params.action === 'ship') return { ...item, status: 'shipped', shippedAt: new Date().toISOString() }
        if (params.action === 'cancel') return { ...item, status: 'cancelled' }
        return {
          ...item,
          status: 'received',
          receivedAt: new Date().toISOString(),
          lines: item.lines!.map((line) => ({ ...line, quantityReceived: body.lines?.find((received) => received.lineId === line.id)?.quantityReceived ?? line.quantitySent })),
        }
      })
      return HttpResponse.json({ transfer: db.transfers.find((item) => item.id === params.id) })
    }),
    mock.get('/api/stock/inventories', () => HttpResponse.json(page(db.inventories))),
    mock.get('/api/stock/inventories/:id', ({ params }) => HttpResponse.json({ inventory: db.inventories.find((item) => item.id === params.id) })),
    mock.post('/api/stock/inventories', async ({ request }) => {
      await record(request)
      const body = (await request.json()) as { shopId: string }
      const inventory: InventoryCount = { id: 'inv-1', shopId: body.shopId, number: 'BTQ1-INV-2026-000001', status: 'draft', notes: null, createdBy: 'user-1', validatedAt: null, createdAt: new Date().toISOString(), lines: [] }
      db.inventories.push(inventory)
      return HttpResponse.json({ inventory }, { status: 201 })
    }),
    mock.put('/api/stock/inventories/:id/lines', async ({ request, params }) => {
      await record(request)
      const body = (await request.json()) as { lines: { productId: string; countedQuantity: string }[] }
      db.inventories = db.inventories.map((item) => {
        if (item.id !== params.id) return item
        const lines = [...(item.lines ?? [])]
        for (const line of body.lines) {
          const existing = lines.findIndex((current) => current.productId === line.productId)
          const next = { id: `il-${line.productId}`, productId: line.productId, countedQuantity: line.countedQuantity, expectedQuantity: null, product: ref(products.find((p) => p.id === line.productId)!) }
          if (existing >= 0) lines[existing] = next
          else lines.push(next)
        }
        return { ...item, lines }
      })
      return HttpResponse.json({ inventory: db.inventories.find((item) => item.id === params.id) })
    }),
    mock.post('/api/stock/inventories/:id/validate', async ({ request, params }) => {
      await record(request)
      db.inventories = db.inventories.map((item) =>
        item.id === params.id
          ? { ...item, status: 'validated', validatedAt: new Date().toISOString(), lines: item.lines!.map((line) => ({ ...line, expectedQuantity: line.productId === 'p-rice' ? '3.000' : '42.500' })) }
          : item,
      )
      return HttpResponse.json({ inventory: db.inventories.find((item) => item.id === params.id) })
    }),
  )
  return { db, lastRequest }
}
