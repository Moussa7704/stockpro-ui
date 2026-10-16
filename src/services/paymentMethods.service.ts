import type { CreatePaymentMethodInput, PaymentMethod, UpdatePaymentMethodInput } from '../types/settings'
import { api } from './api'

/** Moyens de paiement : liste pour tout membre (caisse), gestion avec company.manage. */
export function listPaymentMethods(options: { includeInactive?: boolean } = {}) {
  return api<{ paymentMethods: PaymentMethod[] }>('/payment-methods', {
    params: options.includeInactive ? { includeInactive: true } : undefined,
  })
}

export function createPaymentMethod(input: CreatePaymentMethodInput) {
  return api<{ paymentMethod: PaymentMethod }>('/payment-methods', { method: 'POST', body: input })
}

/** Le code et le type ne changent pas (ils servent aux ventes passées) : nom, ordre, activation. */
export function updatePaymentMethod(id: string, input: UpdatePaymentMethodInput) {
  return api<{ paymentMethod: PaymentMethod }>(`/payment-methods/${id}`, { method: 'PATCH', body: input })
}
