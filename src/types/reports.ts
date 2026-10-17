// Rapports : montants en chaînes décimales, jours du fuseau de l'entreprise

/** Chiffres de ventes d'une période (CA net = CA − retours ; marge = CA net − coût des ventes). */
export interface SalesFigures {
  salesCount: number
  grossSales: string
  discounts: string
  revenue: string
  refunds: string
  netRevenue: string
  cost: string
  grossMargin: string
  marginRate: string | null // en %, null sans chiffre d'affaires
  averageBasket: string
}

export interface TopProduct {
  productId: string
  sku: string
  name: string
  unit: string
  quantity: string
  salesCount: number
  revenue: string
  cost: string
  grossMargin: string
  marginRate: string | null
}

/** Chiffres d'une période du tableau de bord, avec dépenses et résultat (marge − dépenses). */
export type PeriodFigures = SalesFigures & { from: string; to: string; expenses: string; netResult: string }

// GET /api/reports/dashboard?from&to : today, yesterday, month et last7Days restent ceux du jour ;
// stock, créances et caisses sont la situation à l'instant
export interface Dashboard {
  date: string
  currency: string
  timezone: string
  today: SalesFigures
  yesterday: SalesFigures
  month: SalesFigures & { from: string; expenses: string; netResult: string }
  last7Days: { date: string; salesCount: number; netRevenue: string }[]
  /** Période demandée (par défaut le mois en cours) et sa période de comparaison */
  period: PeriodFigures & {
    days: number
    previous: PeriodFigures
    groupBy: 'day' | 'month'
    chart: { period: string; salesCount: number; netRevenue: string }[]
  }
  topProducts: TopProduct[]
  stock: { value: string; lowStockCount: number; outOfStockCount: number }
  customers: { debtorsCount: number; totalDebt: string }
  openCashSessions: number
}

export type GroupBy = 'day' | 'week' | 'month'

export interface SalesReport {
  from: string
  to: string
  groupBy: GroupBy
  currency: string
  rows: (SalesFigures & { period: string })[]
  totals: SalesFigures
}

export interface TopProductsReport {
  from: string
  to: string
  sortBy: 'revenue' | 'quantity' | 'margin'
  items: TopProduct[]
}

export interface StockValueReport {
  date: string
  totals: { value: string; retailValue: string; potentialMargin: string }
  shops: { shopId: string; name: string; products: number; value: string; retailValue: string }[]
  items: { shopId: string; shopName: string; productId: string; sku: string; name: string; unit: string; quantity: string; averageCost: string; value: string; retailValue: string }[]
}

export interface ExpensesReport {
  from: string
  to: string
  total: string
  byCategory: { categoryId: string; name: string; count: number; amount: string }[]
}

export interface ProfitAndLoss {
  from: string
  to: string
  sales: SalesFigures
  expenses: { total: string; byCategory: { categoryId: string; name: string; count: number; amount: string }[] }
  netResult: string
}

export type ReportName = 'sales' | 'top-products' | 'stock-value' | 'expenses' | 'profit-and-loss'
export type ExportFormat = 'xlsx' | 'pdf'
