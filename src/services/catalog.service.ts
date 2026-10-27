import type {
  Category,
  CategoryInput,
  ImportAnalysis,
  ImportOptions,
  ImportReport,
  Product,
  ProductInput,
  ProductListQuery,
  Supplier,
  SupplierInput,
  SupplierListQuery,
  Unit,
  UnitInput,
} from '../types/catalog'
import type { Paginated } from '../types/settings'
import { saveBlob } from '../utils/download'
import { api, http } from './api'

// Catalogue. Lecture : tout membre (unités, catégories) ou products.view (produits, fournisseurs).
// Écriture : products.manage (prix : prices.manage), fournisseurs : purchases.manage.

const archivedParam = (includeArchived?: boolean) => (includeArchived ? { includeArchived: true } : undefined)

// --- Unités
export function listUnits(includeArchived = false) {
  return api<{ units: Unit[] }>('/units', { params: archivedParam(includeArchived) })
}
export function createUnit(input: UnitInput) {
  return api<{ unit: Unit }>('/units', { method: 'POST', body: input })
}
export function updateUnit(id: string, input: Partial<Omit<UnitInput, 'allowsDecimal'>> & { archived?: boolean }) {
  return api<{ unit: Unit }>(`/units/${id}`, { method: 'PATCH', body: input })
}

// --- Catégories (liste à plat avec parentId : l'arbre est construit à l'affichage)
export function listCategories(includeArchived = false) {
  return api<{ categories: Category[] }>('/categories', { params: archivedParam(includeArchived) })
}
export function createCategory(input: CategoryInput) {
  return api<{ category: Category }>('/categories', { method: 'POST', body: input })
}
export function updateCategory(id: string, input: Partial<CategoryInput> & { archived?: boolean }) {
  return api<{ category: Category }>(`/categories/${id}`, { method: 'PATCH', body: input })
}

// --- Fournisseurs
export function listSuppliers(query: SupplierListQuery) {
  return api<Paginated<Supplier>>('/suppliers', { params: { ...query } })
}
export function createSupplier(input: SupplierInput) {
  return api<{ supplier: Supplier }>('/suppliers', { method: 'POST', body: input })
}
export function updateSupplier(id: string, input: Partial<SupplierInput> & { archived?: boolean }) {
  return api<{ supplier: Supplier }>(`/suppliers/${id}`, { method: 'PATCH', body: input })
}

// --- Produits
export function listProducts(query: ProductListQuery) {
  return api<Paginated<Product>>('/products', { params: { ...query } })
}
export function getProduct(id: string) {
  return api<{ product: Product }>(`/products/${id}`)
}
/** Caisse et réception : un produit par code-barres (scan) ou par SKU. */
export function lookupProduct(by: { barcode: string } | { sku: string }) {
  return api<{ product: Product }>('/products/lookup', { params: by })
}
export function createProduct(input: ProductInput) {
  return api<{ product: Product }>('/products', { method: 'POST', body: input })
}
/** N'envoyer que ce qui change : un prix envoyé, même identique, exige prices.manage. */
export function updateProduct(id: string, input: Partial<ProductInput>) {
  return api<{ product: Product }>(`/products/${id}`, { method: 'PATCH', body: input })
}

// --- Import depuis le fichier du commerçant (products.manage). Le fichier est renvoyé à chaque
// étape : le serveur ne garde rien entre l'analyse, l'aperçu et l'import.
function importForm(file: File, options?: ImportOptions): FormData {
  const form = new FormData()
  form.append('file', file)
  if (options) form.append('options', JSON.stringify(options))
  return form
}
/** Étape 1 : colonnes du fichier et correspondance proposée. */
export function analyzeImport(file: File) {
  return api<{ analysis: ImportAnalysis }>('/products/import/analyze', { method: 'POST', body: importForm(file) })
}
/** Aperçu (dryRun) ou import ; l'import est tout ou rien et rejouable sans doublon (clé d'idempotence). */
export function runImport(file: File, options: ImportOptions, idempotencyKey?: string) {
  return api<{ report: ImportReport }>('/products/import', { method: 'POST', body: importForm(file, options), idempotencyKey })
}
export async function downloadImportTemplate() {
  const res = await http.get<Blob>('/products/import/template', { responseType: 'blob' })
  saveBlob(res.data, 'modele-import-produits.xlsx')
}
