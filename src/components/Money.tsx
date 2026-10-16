import { formatMoney } from '../utils/format'

interface MoneyProps {
  value: string | number | null | undefined
  /** Devise de l'entreprise (FCFA par défaut, décision D-01) */
  currency?: string
  className?: string
}

/** Montant aligné à droite dans les tableaux, chiffres à largeur fixe : "1 500 FCFA". */
export function Money({ value, currency = 'XOF', className }: MoneyProps) {
  const negative = typeof value === 'string' ? value.trim().startsWith('-') : typeof value === 'number' && value < 0
  return (
    <span className={`whitespace-nowrap tabular-nums ${negative ? 'text-red-600' : ''} ${className ?? ''}`.trim()}>
      {formatMoney(value, currency)}
    </span>
  )
}
