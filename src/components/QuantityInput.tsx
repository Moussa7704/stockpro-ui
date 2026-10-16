import { InputNumber, type InputNumberProps } from 'antd'

type QuantityInputProps = Omit<InputNumberProps<string>, 'stringMode' | 'value' | 'onChange'> & {
  value?: string | null
  onChange?: (value: string | null) => void
  /** false : entiers seulement (pièce) ; true : jusqu'à 3 décimales (2,5 kg) */
  allowsDecimal?: boolean
  unitSymbol?: string
}

/** Saisie d'une quantité en chaîne décimale, décimales seulement si l'unité le permet. */
export function QuantityInput({ value, onChange, allowsDecimal = false, unitSymbol, ...props }: QuantityInputProps) {
  return (
    <InputNumber<string>
      stringMode
      min="0"
      precision={allowsDecimal ? undefined : 0}
      step={allowsDecimal ? '0.1' : '1'}
      value={value ?? null}
      onChange={(next) => onChange?.(next === null || next === '' ? null : String(next))}
      parser={(text) => (text ?? '').replace(/\s/g, '').replace(',', '.')}
      suffix={unitSymbol}
      className="w-full"
      {...props}
    />
  )
}
