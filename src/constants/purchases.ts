import type { InvoiceStatus, OrderStatus, ReceiptStatus, SupplierPaymentMethod } from '../types/purchases'

type Badge = { label: string; color: string }

export const ORDER_STATUS: Record<OrderStatus, Badge> = {
  draft: { label: 'Brouillon', color: 'default' },
  sent: { label: 'Envoyée', color: 'blue' },
  partially_received: { label: 'Partiellement reçue', color: 'orange' },
  received: { label: 'Reçue', color: 'green' },
  closed: { label: 'Clôturée', color: 'purple' },
  cancelled: { label: 'Annulée', color: 'red' },
}

// Réceptions et retours fournisseurs ont le même cycle : brouillon → validé (ou annulé)
export const DOCUMENT_STATUS: Record<ReceiptStatus, Badge> = {
  draft: { label: 'Brouillon', color: 'default' },
  validated: { label: 'Validé', color: 'green' },
  cancelled: { label: 'Annulé', color: 'red' },
}

export const INVOICE_STATUS: Record<InvoiceStatus, Badge> = {
  unpaid: { label: 'À payer', color: 'orange' },
  partially_paid: { label: 'Payée en partie', color: 'blue' },
  paid: { label: 'Payée', color: 'green' },
  cancelled: { label: 'Annulée', color: 'red' },
}

export const SUPPLIER_PAYMENT_LABELS: Record<SupplierPaymentMethod, string> = {
  cash: 'Espèces',
  bank_transfer: 'Virement',
  mobile_money: 'Mobile Money',
  check: 'Chèque',
  other: 'Autre',
}
