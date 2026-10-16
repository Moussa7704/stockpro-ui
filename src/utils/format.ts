/**
 * Mise en forme pour l'affichage. Les montants arrivent du serveur en chaînes décimales
 * ("1500.00") : on les formate sans passer par un nombre à virgule flottante.
 */

// Espace insécable : "1 500 FCFA" ne se coupe jamais en fin de ligne
const NBSP = '\u00a0'

export function currencyLabel(currency: string): string {
  return currency === 'XOF' ? 'FCFA' : currency
}

/** "1500.00" → "1 500" (FCFA, sans décimales) ; "1500.5" → "1 500,50" pour une autre devise. */
export function formatAmount(value: string | number | null | undefined, currency = 'XOF'): string {
  if (value === null || value === undefined || value === '') return ''
  const text = typeof value === 'number' ? value.toFixed(2) : value.trim()
  const negative = text.startsWith('-')
  const [integer = '0', fraction = ''] = (negative ? text.slice(1) : text).split('.')
  const grouped = integer.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
  const formatted = currency === 'XOF' ? grouped : `${grouped},${fraction.padEnd(2, '0').slice(0, 2)}`
  return negative && /[1-9]/.test(text) ? `-${formatted}` : formatted
}

/** Montant avec sa devise : "1 500 FCFA". */
export function formatMoney(value: string | number | null | undefined, currency = 'XOF'): string {
  const amount = formatAmount(value, currency)
  return amount === '' ? '' : `${amount}${NBSP}${currencyLabel(currency)}`
}

/** "2.500" → "2,5" ; "3.000" → "3". */
export function formatQuantity(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  const text = String(value)
  return text.includes('.') ? text.replace(/\.?0+$/, '').replace('.', ',') : text
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' })
const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

/** "2026-10-16T09:30:00Z" → "16 oct. 2026" ; un jour seul "2026-10-16" reste ce jour-là. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return ''
  // Jour sans heure : midi UTC, pour ne jamais basculer la veille selon le fuseau du navigateur
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value)
  return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date)
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : dateTimeFormatter.format(date)
}
