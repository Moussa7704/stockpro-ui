import { screen, waitFor } from '@testing-library/react'
import { http as mock, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { mockCatalogApi } from '../../test/catalogApi'
import { meResponse } from '../../test/fixtures'
import { renderApp } from '../../test/render'
import { server } from '../../test/server'
import type { ImportAnalysis, ImportReport } from '../../types/catalog'

const manager = meResponse({ permissions: ['products.view', 'products.manage'] })

const fields: ImportAnalysis['fields'] = [
  { field: 'name', label: 'Nom', required: true },
  { field: 'sku', label: 'SKU', required: false },
  { field: 'barcode', label: 'Code-barres', required: false },
  { field: 'category', label: 'Catégorie', required: false },
  { field: 'unit', label: 'Unité', required: false },
  { field: 'salePrice', label: 'Prix de vente', required: true },
  { field: 'purchasePrice', label: "Prix d'achat", required: false },
  { field: 'alertThreshold', label: "Seuil d'alerte", required: false },
  { field: 'description', label: 'Description', required: false },
]

// Fichier d'une boutique : « Montant » n'a pas été reconnu comme prix de vente
const analysis: ImportAnalysis = {
  filename: 'stock.xlsx',
  columns: ['Réf', 'Désignation', 'Famille', 'Montant'],
  rowCount: 3,
  sample: [
    { line: 4, cells: ['R1', 'Riz 25 kg', 'Alimentation', '15000'] },
    { line: 5, cells: ['', 'Savon', 'Hygiène', '500'] },
    { line: 6, cells: ['', 'TOTAL', '', '15500'] },
  ],
  fields,
  suggestedMapping: { sku: 'Réf', name: 'Désignation', category: 'Famille' },
}

function report(overrides: Partial<ImportReport> = {}): ImportReport {
  return {
    dryRun: true,
    filename: 'stock.xlsx',
    totalRows: 3,
    toCreate: 2,
    existing: 0,
    skipped: 1,
    errors: 0,
    categoriesToCreate: ['Alimentation', 'Hygiène'],
    rows: [
      { line: 4, status: 'create', name: 'Riz 25 kg', sku: 'R1' },
      { line: 5, status: 'create', name: 'Savon', sku: 'ART-000001', generatedSku: true },
      { line: 6, status: 'skipped', name: 'TOTAL', sku: null, messages: ['Pas de nom de produit : ligne ignorée (total, titre…)'] },
    ],
    ...overrides,
  }
}

/** Fausse API d'import : garde chaque envoi (options décodées, nom du fichier, clé d'idempotence). */
function mockImportApi(previews: ImportReport[]) {
  const calls: { path: string; filename: string | undefined; options: Record<string, unknown> | null; idempotencyKey: string | null }[] = []
  const record = async (request: Request) => {
    const form = await request.formData()
    const file = form.get('file')
    const options = form.get('options')
    calls.push({
      path: new URL(request.url).pathname,
      // Pas de instanceof : le File reçu par MSW (Node) n'est pas celui de jsdom
      filename: typeof file === 'object' && file !== null ? (file as { name: string }).name : undefined,
      options: typeof options === 'string' ? (JSON.parse(options) as Record<string, unknown>) : null,
      idempotencyKey: request.headers.get('Idempotency-Key'),
    })
    return calls.at(-1)!
  }
  server.use(
    mock.post('/api/products/import/analyze', async ({ request }) => {
      await record(request)
      return HttpResponse.json({ analysis })
    }),
    mock.post('/api/products/import', async ({ request }) => {
      const call = await record(request)
      if (call.options?.dryRun) return HttpResponse.json({ report: previews.shift() ?? report() })
      return HttpResponse.json({ report: report({ dryRun: false, categoriesToCreate: ['Alimentation', 'Hygiène'] }) }, { status: 201 })
    }),
  )
  return calls
}

const xlsx = (name = 'stock.xlsx') => new File(['contenu'], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
const fileInput = () => document.querySelector<HTMLInputElement>('input[type="file"]')!

describe('Import de produits', () => {
  it('fichier → colonnes → vérification → import, avec une seule clé d’idempotence', async () => {
    mockCatalogApi()
    const calls = mockImportApi([report()])
    const { user } = renderApp('/products/import', { session: manager })

    await screen.findByText('Cliquez ou déposez votre fichier ici')
    await user.upload(fileInput(), xlsx())

    // Correspondance proposée par le serveur ; le prix de vente manque encore
    expect(await screen.findByText('Colonnes de « stock.xlsx » (3 ligne(s))')).toBeInTheDocument()
    expect(screen.getByText('ex. : Riz 25 kg')).toBeInTheDocument()
    const checkButton = screen.getByRole('button', { name: 'Vérifier les 3 ligne(s)' })
    expect(checkButton).toBeDisabled()

    await user.click(screen.getByLabelText('Colonne pour Prix de vente'))
    await user.click(await screen.findByTitle('Montant'))
    await waitFor(() => expect(checkButton).toBeEnabled())
    await user.click(checkButton)

    expect(await screen.findByText('À créer : 2')).toBeInTheDocument()
    expect(screen.getByText('Catégories qui seront créées : Alimentation, Hygiène')).toBeInTheDocument()
    expect(screen.getByText('attribuée')).toBeInTheDocument()
    expect(calls.at(-1)).toMatchObject({
      path: '/api/products/import',
      filename: 'stock.xlsx',
      idempotencyKey: null,
      options: {
        mapping: { sku: 'Réf', name: 'Désignation', category: 'Famille', salePrice: 'Montant' },
        defaultUnitId: 'u-pce', // la pièce, proposée par défaut
        createCategories: true,
        dryRun: true,
      },
    })

    await user.click(screen.getByRole('button', { name: 'Importer 2 produit(s)' }))

    expect(await screen.findByText('2 produit(s) importé(s)')).toBeInTheDocument()
    expect(screen.getByText(/catégories créées : Alimentation, Hygiène/)).toBeInTheDocument()
    expect(calls.at(-1)?.options).toMatchObject({ dryRun: false })
    expect(calls.at(-1)?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('lignes en erreur : import bloqué, fichier corrigé rechargé avec les mêmes colonnes', async () => {
    mockCatalogApi()
    const withError = report({
      toCreate: 1,
      errors: 1,
      rows: [
        { line: 4, status: 'create', name: 'Riz 25 kg', sku: 'R1' },
        { line: 5, status: 'error', name: 'Savon', sku: null, messages: ['Prix de vente « abc » invalide'] },
        { line: 6, status: 'skipped', name: 'TOTAL', sku: null },
      ],
    })
    const calls = mockImportApi([withError, report()])
    const { user } = renderApp('/products/import', { session: manager })

    await screen.findByText('Cliquez ou déposez votre fichier ici')
    await user.upload(fileInput(), xlsx())
    await user.click(await screen.findByLabelText('Colonne pour Prix de vente'))
    await user.click(await screen.findByTitle('Montant'))
    await user.click(screen.getByRole('button', { name: 'Vérifier les 3 ligne(s)' }))

    expect(await screen.findByText('1 ligne(s) en erreur : rien ne sera importé tant qu’il en reste')).toBeInTheDocument()
    // Seules les erreurs sont affichées d'abord
    expect(screen.getByText('Prix de vente « abc » invalide')).toBeInTheDocument()
    expect(screen.queryByText('Riz 25 kg')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Importer 1 produit(s)' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Recharger le fichier corrigé' }))
    await user.upload(fileInput(), xlsx('stock-corrige.xlsx'))
    await screen.findByText('Colonnes de « stock.xlsx » (3 ligne(s))')
    // Le choix « Montant » fait à la main est gardé
    await user.click(screen.getByRole('button', { name: 'Vérifier les 3 ligne(s)' }))

    expect(await screen.findByText('À créer : 2')).toBeInTheDocument()
    expect(calls.at(-1)).toMatchObject({ filename: 'stock-corrige.xlsx', options: { mapping: { salePrice: 'Montant' } } })
  })

  it('refuse un fichier trop lourd sans l’envoyer, et affiche l’erreur de lecture du serveur', async () => {
    mockCatalogApi()
    server.use(
      mock.post('/api/products/import/analyze', () =>
        HttpResponse.json({ error: { message: 'Aucune ligne d’en-tête trouvée : la première ligne doit nommer les colonnes' } }, { status: 400 }),
      ),
    )
    const { user } = renderApp('/products/import', { session: manager })
    await screen.findByText('Cliquez ou déposez votre fichier ici')

    const huge = xlsx()
    Object.defineProperty(huge, 'size', { value: 6 * 1024 * 1024 })
    await user.upload(fileInput(), huge)
    expect(await screen.findByText('Fichier trop volumineux (5 Mo max) : découpez-le en plusieurs fichiers')).toBeInTheDocument()

    await user.upload(fileInput(), xlsx())
    expect(await screen.findByText(/Aucune ligne d’en-tête trouvée/)).toBeInTheDocument()
  })

  it('s’ouvre depuis la liste des produits', async () => {
    mockCatalogApi()
    const { user, router } = renderApp('/products', { session: manager })

    await user.click(await screen.findByRole('button', { name: /Importer un fichier/ }))

    expect(await screen.findByRole('heading', { name: 'Importer des produits' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/products/import')
  })

  it('consultation seule (caissier) : pas de bouton d’import', async () => {
    mockCatalogApi()
    renderApp('/products', { session: meResponse({ permissions: ['products.view'], roleCode: 'cashier' }) })

    expect(await screen.findByText('Riz parfumé 25 kg')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Importer un fichier/ })).not.toBeInTheDocument()
  })
})
