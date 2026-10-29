import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryKeys'
import * as shopsService from '../services/shops.service'
import { selectActiveCompany } from '../store/authSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { activeShopChanged, ALL_SHOPS, selectStoredShopId } from '../store/shopSlice'
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
 * Boutique choisie en haut de page : elle filtre tous les écrans (caisse, stock, ventes…) et sert
 * de boutique par défaut dans les formulaires. Celle mémorisée si elle est toujours accessible,
 * sinon la première de la liste. « Toutes les boutiques » (ALL_SHOPS) n'existe qu'à partir de deux
 * boutiques : activeShop vaut alors null.
 */
export function useActiveShop(): {
  shops: ShopSummary[]
  activeShop: ShopSummary | null
  isAllShops: boolean
  setActiveShop: (shopId: string) => void
  isLoading: boolean
} {
  const dispatch = useAppDispatch()
  const activeCompany = useAppSelector(selectActiveCompany)
  const storedShopId = useAppSelector(selectStoredShopId)
  const { data: shops = [], isLoading } = useShops()

  const isAllShops = storedShopId === ALL_SHOPS && shops.length > 1
  const activeShop = isAllShops ? null : (shops.find((shop) => shop.id === storedShopId) ?? shops[0] ?? null)

  return {
    shops,
    activeShop,
    isAllShops,
    isLoading,
    setActiveShop: (shopId) => {
      if (activeCompany) dispatch(activeShopChanged({ companyId: activeCompany.id, shopId }))
    },
  }
}

/** Filtre « boutique » des listes et rapports : la boutique du haut de page, ou undefined pour toutes. */
export function useShopFilter(): string | undefined {
  return useActiveShop().activeShop?.id
}
