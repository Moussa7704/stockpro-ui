import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { queryKeys } from '../../lib/queryKeys'
import * as catalogService from '../../services/catalog.service'
import * as purchasesService from '../../services/purchases.service'
import type { InvoiceStatus, OrderStatus, ReceiptStatus } from '../../types/purchases'

interface Page {
  page: number
  pageSize: number
}

/** Fournisseurs (archivés compris, pour afficher les noms des anciens documents). */
export function useAllSuppliers() {
  return useQuery({
    queryKey: queryKeys.suppliers.list({ page: 1, pageSize: 100, includeArchived: true }),
    queryFn: async () => (await catalogService.listSuppliers({ page: 1, pageSize: 100, includeArchived: true })).items,
    staleTime: 5 * 60_000,
  })
}

/** Nom d'un fournisseur à partir de son identifiant (réceptions et retours ne renvoient que l'id). */
export function useSupplierName() {
  const { data: suppliers = [] } = useAllSuppliers()
  return (supplierId: string) => suppliers.find((supplier) => supplier.id === supplierId)?.name ?? 'Fournisseur'
}

export function useOrders(query: Page & { status?: OrderStatus; supplierId?: string; shopId?: string }) {
  return useQuery({ queryKey: queryKeys.purchases.orders(query), queryFn: () => purchasesService.listOrders(query), placeholderData: keepPreviousData })
}

export function useReceipts(query: Page & { status?: ReceiptStatus; supplierId?: string; shopId?: string }) {
  return useQuery({ queryKey: queryKeys.purchases.receipts(query), queryFn: () => purchasesService.listReceipts(query), placeholderData: keepPreviousData })
}

export function useReturns(query: Page & { status?: ReceiptStatus; supplierId?: string; shopId?: string }) {
  return useQuery({ queryKey: queryKeys.purchases.returns(query), queryFn: () => purchasesService.listReturns(query), placeholderData: keepPreviousData })
}

export function useInvoices(query: Page & { status?: InvoiceStatus; supplierId?: string; overdue?: boolean }) {
  return useQuery({ queryKey: queryKeys.purchases.invoices(query), queryFn: () => purchasesService.listInvoices(query), placeholderData: keepPreviousData })
}

export function useSupplierBalances() {
  return useQuery({ queryKey: queryKeys.purchases.balances, queryFn: async () => (await purchasesService.supplierBalances()).balances })
}
