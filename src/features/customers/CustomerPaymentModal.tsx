import { useMutation } from '@tanstack/react-query'
import { Alert, Form, Input, Modal, Select } from 'antd'
import { useRef, useState } from 'react'
import { AmountInput } from '../../components/AmountInput'
import { Money } from '../../components/Money'
import { useActiveShop } from '../../hook/useActiveShop'
import { getErrorMessage, newIdempotencyKey } from '../../services/api'
import * as customersService from '../../services/customers.service'
import type { CustomerDetail, CustomerPayment } from '../../types/customers'
import { useCurrentSession } from '../pos/queries'
import { usePaymentMethods } from '../settings/queries'

/**
 * Règlement d'une dette : jamais plus que la dette. En espèces, l'argent entre dans le tiroir
 * de MA caisse ouverte dans la boutique : sans caisse ouverte, il faut un autre moyen de paiement.
 */
export function CustomerPaymentModal({ customer, onCancel, onPaid }: { customer: CustomerDetail; onCancel: () => void; onPaid: (payment: CustomerPayment) => void }) {
  const { shops, activeShop } = useActiveShop()
  const { data: methods = [] } = usePaymentMethods()
  const [shopId, setShopId] = useState<string | undefined>(activeShop?.id)
  const [chosenMethodId, setMethodId] = useState<string | undefined>()
  const [amount, setAmount] = useState<string | null>(customer.balance)
  const [reference, setReference] = useState('')
  const key = useRef(newIdempotencyKey())
  const { data: session } = useCurrentSession(shopId)

  // Par défaut les espèces, dès que la liste des moyens de paiement est là
  const methodId = chosenMethodId ?? methods.find((method) => method.type === 'cash')?.id
  const method = methods.find((item) => item.id === methodId)
  const cashWithoutSession = method?.type === 'cash' && session === null
  const tooMuch = amount !== null && Number(amount) > Number(customer.balance)
  const problem = cashWithoutSession
    ? 'Ouvrez votre caisse dans cette boutique pour encaisser en espèces, ou choisissez un autre moyen de paiement.'
    : tooMuch
      ? 'Le montant dépasse la dette du client'
      : !amount || Number(amount) <= 0
        ? 'Indiquez le montant reçu'
        : null

  const pay = useMutation({
    mutationFn: () =>
      customersService.createCustomerPayment(customer.id, { shopId: shopId!, paymentMethodId: methodId!, amount: amount!, reference: reference.trim() || null }, key.current),
    onSuccess: ({ payment }) => onPaid(payment),
  })

  return (
    <Modal
      open
      title={`Règlement de ${customer.name}`}
      okText="Encaisser"
      cancelText="Annuler"
      onOk={() => pay.mutate()}
      onCancel={onCancel}
      okButtonProps={{ disabled: !!problem || !shopId || !methodId, loading: pay.isPending }}
    >
      <Alert type="info" showIcon title={<span>Dette actuelle : <Money value={customer.balance} className="font-semibold" /></span>} className="mb-4" />
      <Form layout="vertical" component="div">
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Form.Item label="Boutique">
            <Select value={shopId} onChange={setShopId} options={shops.map((shop) => ({ value: shop.id, label: shop.name }))} aria-label="Boutique" />
          </Form.Item>
          <Form.Item label="Moyen de paiement">
            <Select value={methodId} onChange={setMethodId} options={methods.map((item) => ({ value: item.id, label: item.name }))} aria-label="Moyen de paiement" />
          </Form.Item>
        </div>
        <Form.Item label="Montant reçu">
          <AmountInput value={amount} onChange={setAmount} size="large" autoFocus aria-label="Montant reçu" />
        </Form.Item>
        <Form.Item label="Référence">
          <Input value={reference} onChange={(event) => setReference(event.target.value)} maxLength={60} placeholder="N° de transaction Mobile Money…" aria-label="Référence" />
        </Form.Item>
      </Form>
      {(problem || pay.error) && <Alert type={pay.error ? 'error' : 'warning'} title={pay.error ? getErrorMessage(pay.error) : problem} showIcon />}
    </Modal>
  )
}
