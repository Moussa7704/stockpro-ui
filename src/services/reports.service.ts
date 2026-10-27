import type { Dashboard, ExpensesReport, ExportFormat, ProfitAndLoss, ReportName, SalesReport, StockValueReport, TopProductsReport } from '../types/reports'
import { filenameFrom, saveBlob } from '../utils/download'
import { api, http } from './api'

// Rapports (permission reports.view). Les mêmes adresses renvoient un fichier Excel ou PDF
// avec ?format=xlsx|pdf.

type Period = { from: string; to: string; shopId?: string }

export type DashboardQuery = { shopId?: string; from?: string; to?: string }

export function getDashboard(query: DashboardQuery = {}) {
  return api<{ dashboard: Dashboard }>('/reports/dashboard', { params: { ...query } })
}
export function getSalesReport(query: Period & { groupBy: SalesReport['groupBy'] }) {
  return api<{ report: SalesReport }>('/reports/sales', { params: { ...query } })
}
export function getTopProducts(query: Period & { sortBy?: TopProductsReport['sortBy']; limit?: number }) {
  return api<{ report: TopProductsReport }>('/reports/top-products', { params: { ...query } })
}
export function getStockValue(shopId?: string) {
  return api<{ report: StockValueReport }>('/reports/stock-value', { params: { shopId } })
}
export function getExpensesReport(query: Period) {
  return api<{ report: ExpensesReport }>('/reports/expenses', { params: { ...query } })
}
export function getProfitAndLoss(query: Period) {
  return api<{ report: ProfitAndLoss }>('/reports/profit-and-loss', { params: { ...query } })
}

/** Télécharge un rapport en Excel ou PDF : le fichier est enregistré par le navigateur. */
export async function downloadReport(report: ReportName, format: ExportFormat, params: Record<string, string | number | undefined>) {
  const res = await http.get<Blob>(`/reports/${report}`, { params: { ...params, format }, responseType: 'blob' })
  saveBlob(res.data, filenameFrom(res.headers['content-disposition'] as string | undefined, `${report}.${format}`))
}
