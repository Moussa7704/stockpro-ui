import { PercentageOutlined } from '@ant-design/icons'
import { Button, InputNumber, Popover, Segmented } from 'antd'
import { useState } from 'react'
import type { Discount } from '../../types/pos'
import { formatMoney } from '../../utils/format'

interface DiscountButtonProps {
  value: Discount | undefined
  onChange: (discount: Discount | undefined) => void
  label: string
  size?: 'small' | 'middle'
}

const describe = (discount: Discount) => (discount.type === 'percent' ? `−${discount.value} %` : `−${formatMoney(discount.value)}`)

/** Remise en montant (FCFA) ou en pourcentage, sur une ligne ou sur tout le ticket. */
export function DiscountButton({ value, onChange, label, size = 'small' }: DiscountButtonProps) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<Discount['type']>(value?.type ?? 'percent')
  const [amount, setAmount] = useState<string | null>(value?.value ?? null)

  const apply = () => {
    onChange(amount && Number(amount) > 0 ? { type, value: amount } : undefined)
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      title={label}
      content={
        <div className="flex w-56 flex-col gap-3">
          <Segmented<Discount['type']>
            block
            value={type}
            onChange={setType}
            options={[
              { value: 'percent', label: '%' },
              { value: 'amount', label: 'Montant' },
            ]}
            aria-label="Type de remise"
          />
          <InputNumber<string>
            stringMode
            autoFocus
            min="0"
            max={type === 'percent' ? '100' : undefined}
            precision={0}
            value={amount}
            onChange={(next) => setAmount(next === null ? null : String(next))}
            onPressEnter={apply}
            suffix={type === 'percent' ? '%' : 'FCFA'}
            className="w-full"
            aria-label="Valeur de la remise"
          />
          <div className="flex justify-between gap-2">
            <Button
              size="small"
              onClick={() => {
                setAmount(null)
                onChange(undefined)
                setOpen(false)
              }}
            >
              Retirer
            </Button>
            <Button size="small" type="primary" onClick={apply}>
              Appliquer
            </Button>
          </div>
        </div>
      }
    >
      <Button size={size} icon={<PercentageOutlined />} type={value ? 'primary' : 'default'} ghost={!!value} aria-label={label}>
        {value ? describe(value) : size === 'middle' ? 'Remise' : null}
      </Button>
    </Popover>
  )
}
