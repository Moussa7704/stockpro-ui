import { InputNumber, type InputNumberProps } from 'antd'
import { currencyLabel } from '../utils/format'

type AmountInputProps = Omit<InputNumberProps<string>, 'stringMode' | 'value' | 'onChange'> & {
  value?: string | null
  onChange?: (value: string | null) => void
  currency?: string
}

/**
 * Saisie d'un montant : valeur en chaîne décimale ("1500"), jamais en nombre flottant ;
 * FCFA sans décimales, milliers séparés à l'affichage. S'utilise directement dans un Form.Item.
 */
export function AmountInput({ value, onChange, currency = 'XOF', ...props }: AmountInputProps) {
  return (
    <InputNumber<string>
      stringMode
      min="0"
      precision={currency === 'XOF' ? 0 : 2}
      value={value ?? null}
      onChange={(next) => onChange?.(next === null || next === '' ? null : String(next))}
      formatter={(raw) => (raw ? String(raw).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : '')}
      parser={(text) => (text ?? '').replace(/[\s\u00a0\u202f]/g, '').replace(',', '.')}
      suffix={currencyLabel(currency)}
      className="w-full"
      {...props}
    />
  )
}
