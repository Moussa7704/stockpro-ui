import type { PaymentMethodType } from '../types/settings'

export const PAYMENT_TYPE_LABELS: Record<PaymentMethodType, string> = {
  cash: 'Espèces',
  mobile_money: 'Mobile Money',
  card: 'Carte bancaire',
  bank: 'Virement / chèque',
  other: 'Autre',
}
