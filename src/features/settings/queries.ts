import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../../lib/queryKeys'
import * as companyService from '../../services/company.service'
import * as paymentMethodsService from '../../services/paymentMethods.service'
import * as shopsService from '../../services/shops.service'

/** Entreprise active : nom, devise, fuseau horaire, réglages. */
export function useCompany() {
  return useQuery({
    queryKey: queryKeys.company,
    queryFn: async () => (await companyService.getCompany()).company,
  })
}

/** Toutes les boutiques, archivées comprises (écran de paramétrage, permission company.manage). */
export function useAllShops() {
  return useQuery({
    queryKey: queryKeys.shops.withArchived,
    queryFn: async () => (await shopsService.listShops({ includeArchived: true })).shops,
  })
}

/** Moyens de paiement : actifs seulement (caisse), ou tous (paramétrage). */
export function usePaymentMethods(options: { includeInactive?: boolean } = {}) {
  return useQuery({
    queryKey: options.includeInactive ? queryKeys.paymentMethods.withInactive : queryKeys.paymentMethods.all,
    queryFn: async () => (await paymentMethodsService.listPaymentMethods(options)).paymentMethods,
  })
}
