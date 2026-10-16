import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Alert, Button, Modal, Select, Typography } from 'antd'
import { useState } from 'react'
import { AmountInput } from '../../components/AmountInput'
import { Money } from '../../components/Money'
import type { PaymentMethod } from '../../types/settings'
import { formatMoney } from '../../utils/format'
import { fromCents, settle } from './pricing'

export interface PaymentLine {
  methodId: string
  amount: string | null
}

interface PaymentModalProps {
  totalCents: number
  methods: PaymentMethod[]
  hasCustomer: boolean
  submitting: boolean
  error: string | null
  onCancel: () => void
  onConfirm: (payments: { methodId: string; amount: string }[]) => void
}

/** Billets ronds proposés au-dessus du total (ex. total 4 350 → 4 500, 5 000, 10 000). */
function cashSuggestions(totalCents: number): number[] {
  const total = totalCents / 100
  const steps = [500, 1000, 2000, 5000, 10000]
  const values = new Set<number>()
  for (const step of steps) {
    const rounded = Math.ceil(total / step) * step
    if (rounded > total) values.add(rounded)
  }
  return [...values].sort((a, b) => a - b).slice(0, 4)
}

/**
 * Encaissement : un ou plusieurs moyens de paiement (ex. Mobile Money + espèces), monnaie rendue
 * sur les espèces, reste dû seulement pour un client (vente à crédit).
 */
export function PaymentModal({ totalCents, methods, hasCustomer, submitting, error, onCancel, onConfirm }: PaymentModalProps) {
  const cashMethod = methods.find((method) => method.type === 'cash') ?? methods[0]
  // null : rien saisi, on propose les espèces pour le total (même si les moyens de paiement
  // arrivent après l'ouverture de la fenêtre)
  const [edited, setEdited] = useState<PaymentLine[] | null>(null)
  const payments: PaymentLine[] = edited ?? (cashMethod ? [{ methodId: cashMethod.id, amount: fromCents(totalCents) }] : [])
  const setPayments = (update: (current: PaymentLine[]) => PaymentLine[]) => setEdited(update(payments))
  const isCash = (methodId: string) => methods.find((method) => method.id === methodId)?.type === 'cash'

  const filled = payments.filter((payment) => payment.amount && Number(payment.amount) > 0)
  const settlement = settle(
    totalCents,
    filled.map((payment) => ({ amount: payment.amount!, isCash: isCash(payment.methodId) })),
  )
  const blocking =
    settlement.error ?? (settlement.balanceDue > 0 && !hasCustomer ? 'Paiement incomplet : choisissez un client pour une vente à crédit' : null)

  const update = (index: number, patch: Partial<PaymentLine>) => setPayments((current) => current.map((payment, i) => (i === index ? { ...payment, ...patch } : payment)))
  const cashIndex = payments.findIndex((payment) => isCash(payment.methodId))

  return (
    <Modal
      open
      title="Encaissement"
      onCancel={onCancel}
      width={560}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel}>Retour au panier</Button>
          <Button
            type="primary"
            size="large"
            disabled={!!blocking}
            loading={submitting}
            onClick={() => onConfirm(filled.map((payment) => ({ methodId: payment.methodId, amount: payment.amount! })))}
          >
            Valider la vente
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-lg bg-slate-50 p-4 text-center">
          <Typography.Text type="secondary">À payer</Typography.Text>
          <div className="text-3xl font-bold">
            <Money value={fromCents(totalCents)} />
          </div>
        </div>

        {payments.map((payment, index) => (
          <div key={index} className="flex items-center gap-2">
            <Select
              value={payment.methodId}
              onChange={(methodId) => update(index, { methodId })}
              options={methods.map((method) => ({ value: method.id, label: method.name }))}
              className="w-44"
              aria-label={`Moyen de paiement ${index + 1}`}
            />
            <AmountInput value={payment.amount} onChange={(amount) => update(index, { amount })} size="large" aria-label={`Montant ${index + 1}`} />
            {payments.length > 1 && (
              <Button type="text" danger icon={<DeleteOutlined />} onClick={() => setPayments((current) => current.filter((_, i) => i !== index))} aria-label={`Retirer le paiement ${index + 1}`} />
            )}
          </div>
        ))}

        {cashIndex >= 0 && (
          <div className="flex flex-wrap gap-2">
            <Typography.Text type="secondary" className="self-center">
              Espèces reçues :
            </Typography.Text>
            {cashSuggestions(totalCents).map((value) => (
              <Button key={value} onClick={() => update(cashIndex, { amount: String(value) })}>
                {formatMoney(value)}
              </Button>
            ))}
          </div>
        )}

        {methods.length > payments.length && (
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => {
              const unused = methods.find((method) => !payments.some((payment) => payment.methodId === method.id))
              if (unused) setPayments((current) => [...current, { methodId: unused.id, amount: null }])
            }}
          >
            Ajouter un moyen de paiement
          </Button>
        )}

        <div className="flex flex-col gap-1 border-t border-slate-200 pt-3 text-base">
          <div className="flex justify-between">
            <span>Reçu</span>
            <Money value={fromCents(settlement.paid)} />
          </div>
          {settlement.change > 0 && (
            <div className="flex justify-between text-lg font-semibold text-green-700">
              <span>Monnaie à rendre</span>
              <Money value={fromCents(settlement.change)} />
            </div>
          )}
          {settlement.balanceDue > 0 && (
            <div className="flex justify-between font-semibold text-orange-600">
              <span>Reste dû {hasCustomer && '(crédit client)'}</span>
              <Money value={fromCents(settlement.balanceDue)} />
            </div>
          )}
        </div>

        {(blocking || error) && <Alert type="error" title={blocking ?? error} showIcon />}
      </div>
    </Modal>
  )
}
