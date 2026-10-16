import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useShops } from '../../hook/useActiveShop'
import { queryKeys } from '../../lib/queryKeys'
import * as stockService from '../../services/stock.service'
import type { MovementType, TransferStatus } from '../../types/stock'

interface Page {
  page: number
  pageSize: number
}

export function useStockLevels(query: Page & { shopId?: string; search?: string; lowStock?: boolean }) {
  return useQuery({
    queryKey: queryKeys.stock.levels(query),
    queryFn: () => stockService.listStockLevels(query),
    placeholderData: keepPreviousData,
  })
}

export function useStockAlerts(shopId?: string) {
  return useQuery({
    queryKey: queryKeys.stock.alerts(shopId),
    queryFn: async () => (await stockService.listStockAlerts(shopId)).alerts,
  })
}

export function useMovements(query: Page & { shopId?: string; productId?: string; type?: MovementType }) {
  return useQuery({
    queryKey: queryKeys.stock.movements(query),
    queryFn: () => stockService.listMovements(query),
    placeholderData: keepPreviousData,
  })
}

export function useAdjustments(query: Page & { shopId?: string }) {
  return useQuery({
    queryKey: queryKeys.stock.adjustments(query),
    queryFn: () => stockService.listAdjustments(query),
    placeholderData: keepPreviousData,
  })
}

export function useTransfers(query: Page & { shopId?: string; status?: TransferStatus }) {
  return useQuery({
    queryKey: queryKeys.stock.transfers(query),
    queryFn: () => stockService.listTransfers(query),
    placeholderData: keepPreviousData,
  })
}

export function useInventories(query: Page & { shopId?: string }) {
  return useQuery({
    queryKey: queryKeys.stock.inventories(query),
    queryFn: () => stockService.listInventories(query),
    placeholderData: keepPreviousData,
  })
}

/** Nom d'une boutique à partir de son identifiant (les documents ne renvoient que l'id). */
export function useShopName() {
  const { data: shops = [] } = useShops()
  return (shopId: string) => shops.find((shop) => shop.id === shopId)?.name ?? 'Autre boutique'
}
