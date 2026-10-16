import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryKeys'
import * as shopsService from '../services/shops.service'
import { selectActiveCompany } from '../store/authSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { activeShopChanged, selectStoredShopId } from '../store/shopSlice'
import type { ShopSummary } from '../types/access'

/** Boutiques accessibles dans l'entreprise active (cache partagé par tous les écrans). */
export function useShops() {
  const activeCompany = useAppSelector(selectActiveCompany)
  return useQuery({
    queryKey: queryKeys.shops.all,
    queryFn: async () => (await shopsService.listShops()).shops,
    enabled: activeCompany !== null,
  })
}

/**
 * Boutique dans laquelle on travaille (caisse, stock…). Celle mémorisée si elle est toujours
 * accessible, sinon la première de la liste.
 */
export function useActiveShop(): {
  shops: ShopSummary[]
  activeShop: ShopSummary | null
  setActiveShop: (shopId: string) => void
  isLoading: boolean
} {
  const dispatch = useAppDispatch()
  const activeCompany = useAppSelector(selectActiveCompany)
  const storedShopId = useAppSelector(selectStoredShopId)
  const { data: shops = [], isLoading } = useShops()

  const activeShop = shops.find((shop) => shop.id === storedShopId) ?? shops[0] ?? null

  return {
    shops,
    activeShop,
    isLoading,
    setActiveShop: (shopId) => {
      if (activeCompany) dispatch(activeShopChanged({ companyId: activeCompany.id, shopId }))
    },
  }
}
