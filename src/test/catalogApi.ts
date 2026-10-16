import { http as mock, HttpResponse } from 'msw'
import type { Category, Product, Supplier, Unit } from '../types/catalog'
import { shopsFixture } from './fixtures'
import { server } from './server'

/**
 * Fausse API du catalogue, avec état (les créations et modifications sont relues ensuite)
 * et un journal des requêtes reçues pour vérifier ce que l'écran envoie.
 */
export function useCatalogApi() {
  const units: Unit[] = [
    { id: 'u-pce', name: 'Pièce', symbol: 'pce', allowsDecimal: false, archivedAt: null },
    { id: 'u-kg', name: 'Kilogramme', symbol: 'kg', allowsDecimal: true, archivedAt: null },
  ]
  const db = {
    units,
    categories: [
      { id: 'c-food', parentId: null, name: 'Épicerie', archivedAt: null },
      { id: 'c-rice', parentId: 'c-food', name: 'Riz', archivedAt: null },
      { id: 'c-drinks', parentId: null, name: 'Boissons', archivedAt: null },
    ] as Category[],
    suppliers: [
      { id: 'sup-1', name: 'Grossiste du port', contactName: 'Ibrahima', phone: '+221770000000', email: null, address: null, notes: null, archivedAt: null, createdAt: '2026-10-01T10:00:00.000Z' },
    ] as Supplier[],
    products: [
      product('p-rice', 'Riz parfumé 25 kg', 'RIZ-25', '15000.00', units[0]!, { id: 'c-rice', name: 'Riz' }, '12500.00'),
      product('p-sugar', 'Sucre en poudre', 'SUCRE', '800.00', units[1]!, { id: 'c-food', name: 'Épicerie' }, null),
    ],
    requests: [] as { method: string; path: string; search: string; body: unknown }[],
  }

  const record = async (request: Request) => {
    const url = new URL(request.url)
    db.requests.push({ method: request.method, path: url.pathname, search: url.search, body: await request.clone().json().catch(() => null) })
  }
  const lastRequest = (method: string, path: string) => [...db.requests].reverse().find((item) => item.method === method && item.path.startsWith(path))

  server.use(
    mock.get('/api/shops', () => HttpResponse.json({ shops: shopsFixture })),
    mock.get('/api/units', () => HttpResponse.json({ units: db.units })),
    mock.post('/api/units', async ({ request }) => {
      await record(request)
      const unit = { id: `u-${db.units.length + 1}`, archivedAt: null, allowsDecimal: false, ...((await request.json()) as Partial<Unit>) } as Unit
      db.units.push(unit)
      return HttpResponse.json({ unit }, { status: 201 })
    }),
    mock.get('/api/categories', () => HttpResponse.json({ categories: db.categories })),
    mock.post('/api/categories', async ({ request }) => {
      await record(request)
      const category = { id: `c-${db.categories.length + 1}`, archivedAt: null, parentId: null, ...((await request.json()) as Partial<Category>) } as Category
      db.categories.push(category)
      return HttpResponse.json({ category }, { status: 201 })
    }),
    mock.patch('/api/categories/:id', async ({ request, params }) => {
      await record(request)
      const body = (await request.json()) as Partial<Category> & { archived?: boolean }
      db.categories = db.categories.map((item) =>
        item.id === params.id
          ? { ...item, ...body, archivedAt: body.archived === undefined ? item.archivedAt : body.archived ? '2026-10-16T10:00:00.000Z' : null }
          : item,
      )
      return HttpResponse.json({ category: db.categories.find((item) => item.id === params.id) })
    }),
    mock.get('/api/suppliers', async ({ request }) => {
      await record(request)
      const search = new URL(request.url).searchParams.get('search')?.toLowerCase()
      const items = db.suppliers.filter((item) => !search || item.name.toLowerCase().includes(search))
      return HttpResponse.json({ items, total: items.length, page: 1, pageSize: 20 })
    }),
    mock.post('/api/suppliers', async ({ request }) => {
      await record(request)
      const supplier = { id: `sup-${db.suppliers.length + 1}`, archivedAt: null, createdAt: new Date().toISOString(), contactName: null, phone: null, email: null, address: null, notes: null, ...((await request.json()) as Partial<Supplier>) } as Supplier
      db.suppliers.push(supplier)
      return HttpResponse.json({ supplier }, { status: 201 })
    }),
    mock.get('/api/products', async ({ request }) => {
      await record(request)
      const params = new URL(request.url).searchParams
      const search = params.get('search')?.toLowerCase()
      const status = params.get('status') ?? 'active'
      const items = db.products.filter(
        (item) =>
          (!search || `${item.name} ${item.sku} ${item.barcode ?? ''}`.toLowerCase().includes(search)) &&
          (status === 'all' || item.status === status) &&
          (!params.get('categoryId') || item.categoryId === params.get('categoryId')),
      )
      return HttpResponse.json({ items, total: items.length, page: Number(params.get('page')), pageSize: 20 })
    }),
    mock.post('/api/products', async ({ request }) => {
      await record(request)
      const body = (await request.json()) as Product
      const unit = db.units.find((item) => item.id === body.unitId)!
      const created = product(`p-${db.products.length + 1}`, body.name, body.sku, body.salePrice, unit, null, body.purchasePriceHint ?? null)
      db.products.push({ ...created, barcode: body.barcode ?? null })
      return HttpResponse.json({ product: created }, { status: 201 })
    }),
    mock.patch('/api/products/:id', async ({ request, params }) => {
      await record(request)
      const body = (await request.json()) as Partial<Product>
      db.products = db.products.map((item) => (item.id === params.id ? { ...item, ...body } : item))
      return HttpResponse.json({ product: db.products.find((item) => item.id === params.id) })
    }),
  )
  return { db, lastRequest }
}

function product(
  id: string,
  name: string,
  sku: string,
  salePrice: string,
  unit: Unit,
  category: { id: string; name: string } | null,
  purchasePriceHint: string | null,
): Product {
  return {
    id,
    sku,
    barcode: null,
    name,
    description: null,
    categoryId: category?.id ?? null,
    unitId: unit.id,
    salePrice,
    purchasePriceHint,
    alertThreshold: '0',
    status: 'active',
    unit: { id: unit.id, name: unit.name, symbol: unit.symbol, allowsDecimal: unit.allowsDecimal },
    category,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  }
}
