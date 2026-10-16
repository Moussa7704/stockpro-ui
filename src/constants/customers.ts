import type { LedgerType } from '../types/customers'

export const LEDGER_LABELS: Record<LedgerType, string> = {
  sale_credit: 'Vente à crédit',
  sale_cancellation: 'Vente annulée',
  payment: 'Règlement',
  return_credit: 'Retour (avoir)',
  adjustment: 'Ajustement',
}
