import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { queryKeys } from '../../lib/queryKeys'
import * as catalogService from '../../services/catalog.service'
import type { ProductListQuery, SupplierListQuery } from '../../types/catalog'

/** Unités (actives, ou toutes pour l'écran de gestion). Changent rarement : cache long. */
export function useUnits(includeArchived = false) {
  return useQuery({
    queryKey: includeArchived ? queryKeys.units.withArchived : queryKeys.units.all,
    queryFn: async () => (await catalogService.listUnits(includeArchived)).units,
    staleTime: 5 * 60_000,
  })
}

export function useCategories(includeArchived = false) {
  return useQuery({
    queryKey: includeArchived ? queryKeys.categories.withArchived : queryKeys.categories.all,
    queryFn: async () => (await catalogService.listCategories(includeArchived)).categories,
    staleTime: 5 * 60_000,
  })
}

export function useSuppliers(query: SupplierListQuery) {
  return useQuery({
    queryKey: queryKeys.suppliers.list(query),
    queryFn: () => catalogService.listSuppliers(query),
    placeholderData: keepPreviousData,
  })
}

export function useProducts(query: ProductListQuery) {
  return useQuery({
    queryKey: queryKeys.products.list(query),
    queryFn: () => catalogService.listProducts(query),
    // La page suivante se charge sans vider le tableau
    placeholderData: keepPreviousData,
  })
}
