// Catalogue : unités, catégories, fournisseurs, produits (montants et quantités en chaînes décimales)

export interface Unit {
  id: string
  name: string
  symbol: string
  // false : quantités entières uniquement (pièce) ; true : 2,5 kg possible
  allowsDecimal: boolean
  archivedAt: string | null
}

export interface UnitInput {
  name: string
  symbol: string
  allowsDecimal?: boolean // fixé à la création (des stocks à 2,5 deviendraient invalides)
}

export interface Category {
  id: string
  parentId: string | null
  name: string
  archivedAt: string | null
}

export interface CategoryInput {
  name: string
  parentId?: string | null
}

export interface Supplier {
  id: string
  name: string
  contactName: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  archivedAt: string | null
  createdAt: string
}

export interface SupplierInput {
  name: string
  contactName?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
}

export type ProductStatus = 'active' | 'archived'

export interface Product {
  id: string
  sku: string
  barcode: string | null
  name: string
  description: string | null
  categoryId: string | null
  unitId: string
  salePrice: string // "1500.00"
  purchasePriceHint: string | null // prix d'achat indicatif (le coût réel est le CMP du stock)
  alertThreshold: string // quantité sous laquelle le stock est signalé bas
  status: ProductStatus
  unit: Pick<Unit, 'id' | 'name' | 'symbol' | 'allowsDecimal'>
  category: Pick<Category, 'id' | 'name'> | null
  createdAt: string
  updatedAt: string
}

export interface ProductInput {
  sku: string
  barcode?: string | null
  name: string
  description?: string | null
  categoryId?: string | null
  unitId: string
  salePrice: string
  purchasePriceHint?: string | null
  alertThreshold?: string
  status?: ProductStatus
}

export const PRODUCT_SORT_FIELDS = ['name', 'sku', 'salePrice', 'createdAt'] as const
export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number]

export interface ProductListQuery {
  page: number
  pageSize: number
  search?: string
  categoryId?: string
  status?: ProductStatus | 'all'
  sort?: ProductSortField
  order?: 'asc' | 'desc'
}

export interface SupplierListQuery {
  page: number
  pageSize: number
  search?: string
  includeArchived?: boolean
}

// --- Import de produits depuis le fichier du commerçant (.xlsx / .csv)
export const IMPORT_FIELDS = ['name', 'sku', 'barcode', 'category', 'unit', 'salePrice', 'purchasePrice', 'alertThreshold', 'description', 'quantity'] as const
export type ImportField = (typeof IMPORT_FIELDS)[number]
/** Champ StockPro → nom de la colonne du fichier */
export type ImportMapping = Partial<Record<ImportField, string>>

export interface ImportAnalysis {
  filename: string
  columns: string[]
  rowCount: number
  /** Premières lignes, numérotées comme dans le fichier */
  sample: { line: number; cells: string[] }[]
  fields: { field: ImportField; label: string; required: boolean }[]
  suggestedMapping: ImportMapping
}

export interface ImportOptions {
  mapping: ImportMapping
  /** Boutique qui reçoit le stock de départ (obligatoire si la quantité est importée) */
  shopId?: string
  defaultUnitId?: string
  createCategories: boolean
  dryRun: boolean
}

export type ImportRowStatus = 'create' | 'existing' | 'skipped' | 'error'

export interface ImportRow {
  line: number
  status: ImportRowStatus
  name: string
  sku: string | null
  generatedSku?: boolean
  /** Quantité lue dans le fichier */
  quantity?: string
  /** opening : entre en stock d'ouverture ; already_stocked : déjà du stock dans la boutique, ignorée */
  stock?: 'opening' | 'already_stocked'
  messages?: string[]
}

export interface ImportReport {
  dryRun: boolean
  filename: string
  totalRows: number
  /** Aperçu : produits qui seraient créés ; import : produits créés */
  toCreate: number
  existing: number
  skipped: number
  errors: number
  /** Aperçu : catégories qui seraient créées ; import : catégories créées */
  categoriesToCreate: string[]
  /** Stock de départ (null si aucune colonne de quantité) */
  stock: {
    shop: { id: string; code: string; name: string }
    lines: number
    alreadyStocked: number
    /** Pièce « stock d'ouverture » créée à l'import (null à l'aperçu) */
    adjustment: { id: string; number: string } | null
  } | null
  rows: ImportRow[]
}
