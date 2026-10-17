import type { CustomerPayment } from '../../types/customers'
import { formatDate, formatDateTime, formatMoney } from '../../utils/format'

/** Même largeur que le ticket de caisse : 42 caractères (imprimante 80 mm, chasse fixe). */
export const RECEIPT_WIDTH = 42
const WIDTH = RECEIPT_WIDTH

const center = (text: string) => ' '.repeat(Math.max(0, Math.floor((WIDTH - text.length) / 2))) + text
const line = (label: string, value: string) => {
  const gap = WIDTH - label.length - value.length
  return gap >= 1 ? `${label}${' '.repeat(gap)}${value}` : `${label}\n${' '.repeat(Math.max(0, WIDTH - value.length))}${value}`
}
const rule = '-'.repeat(WIDTH)

/** Numéro court du reçu, lisible et retrouvable (début de l'identifiant du règlement). */
export const receiptNumber = (paymentId: string) => `R-${paymentId.replaceAll('-', '').slice(0, 8).toUpperCase()}`

interface ReceiptContext {
  companyName: string
  shopName?: string
  customerName: string
  /**
   * Juste après l'encaissement, la dette renvoyée est celle qui reste après ce règlement ;
   * en réimpression, c'est la dette du jour : on le dit, avec la date.
   */
  justPaid: boolean
  printedAt?: Date
}

/** Reçu d'un règlement de dette client, en texte (aperçu à l'écran et impression). */
export function buildPaymentReceipt(payment: CustomerPayment, context: ReceiptContext): string {
  const balance = payment.customerBalance
  const lines = [
    center(context.companyName),
    ...(context.shopName ? [center(context.shopName)] : []),
    '',
    center('REÇU DE RÈGLEMENT'),
    center(receiptNumber(payment.id)),
    rule,
    `Date : ${formatDateTime(payment.createdAt)}`,
    `Client : ${context.customerName}`,
    `Moyen : ${payment.paymentMethod?.name ?? '—'}`,
    ...(payment.reference ? [`Référence : ${payment.reference}`] : []),
    rule,
    line('Montant reçu', formatMoney(payment.amount)),
    ...(balance === undefined
      ? []
      : context.justPaid
        ? [line('Dette restante', formatMoney(balance))]
        : [line(`Dette au ${formatDate(context.printedAt ?? new Date())}`, formatMoney(balance))]),
    rule,
    center('Merci de votre confiance'),
  ]
  // Espaces insécables des montants → espaces simples : alignement garanti à l'impression
  return lines.join('\n').replaceAll(/[  ]/g, ' ')
}
