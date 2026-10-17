import { PrinterOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Modal, Skeleton } from 'antd'
import { useShops } from '../../hook/useActiveShop'
import { useAuth } from '../../hook/useAuth'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage } from '../../services/api'
import * as customersService from '../../services/customers.service'
import { printText } from '../../utils/print'
import { buildPaymentReceipt, receiptNumber } from './paymentReceipt'

interface PaymentReceiptModalProps {
  paymentId: string
  customerName: string
  /** true : ouvert juste après l'encaissement (la dette indiquée est celle qui reste) */
  justPaid?: boolean
  onClose: () => void
}

/** Reçu d'un règlement client : aperçu et impression (après encaissement ou en réimpression). */
export function PaymentReceiptModal({ paymentId, customerName, justPaid = false, onClose }: PaymentReceiptModalProps) {
  const { activeCompany } = useAuth()
  const { data: shops = [] } = useShops()
  const { data: payment, error } = useQuery({
    queryKey: queryKeys.customers.payment(paymentId),
    queryFn: async () => (await customersService.getCustomerPayment(paymentId)).payment,
  })
  const text =
    payment &&
    buildPaymentReceipt(payment, {
      companyName: activeCompany?.name ?? '',
      shopName: shops.find((shop) => shop.id === payment.shopId)?.name,
      customerName,
      justPaid,
    })

  return (
    <Modal
      open
      title={`Reçu ${receiptNumber(paymentId)}`}
      onCancel={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Fermer</Button>
          <Button type="primary" icon={<PrinterOutlined />} disabled={!text} onClick={() => text && printText(text, `Reçu ${receiptNumber(paymentId)}`)}>
            Imprimer
          </Button>
        </div>
      }
    >
      {error && <Alert type="error" title={getErrorMessage(error)} showIcon />}
      {!text ? (
        !error && <Skeleton active />
      ) : (
        <pre aria-label="Aperçu du reçu" className="max-h-96 overflow-auto rounded bg-slate-50 p-3 font-mono text-xs leading-snug">
          {text}
        </pre>
      )}
    </Modal>
  )
}
