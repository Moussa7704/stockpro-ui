import { PrinterOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Alert, Button, Descriptions, Drawer, Form, Input, Modal, Segmented, Select, Skeleton, Switch, Table, Tag, Typography } from 'antd'
import { useRef, useState } from 'react'
import { Money } from '../../components/Money'
import { QuantityInput } from '../../components/QuantityInput'
import { usePermission } from '../../hook/usePermission'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage, newIdempotencyKey } from '../../services/api'
import * as posService from '../../services/pos.service'
import type { Sale, SaleLine } from '../../types/pos'
import { formatDateTime, formatQuantity } from '../../utils/format'
import { usePaymentMethods } from '../settings/queries'
import { useShopName } from '../stock/queries'

/** Annulation d'une vente : stock restitué, argent rendu, crédit effacé. Motif obligatoire. */
function CancelSaleModal({ sale, onCancel, onDone }: { sale: Sale; onCancel: () => void; onDone: (message: string) => void }) {
  const [reason, setReason] = useState('')
  const key = useRef(newIdempotencyKey())
  const cancel = useMutation({
    mutationFn: () => posService.cancelSale(sale.id, reason.trim(), key.current),
    onSuccess: ({ sale: cancelled }) => onDone(`Vente ${cancelled.number} annulée`),
  })
  return (
    <Modal
      open
      title={`Annuler la vente ${sale.number} ?`}
      okText="Annuler la vente"
      okButtonProps={{ danger: true, disabled: reason.trim().length < 3, loading: cancel.isPending }}
      cancelText="Retour"
      onOk={() => cancel.mutate()}
      onCancel={onCancel}
    >
      <Typography.Paragraph>Les articles reviennent en stock et le client est remboursé. Cette action est enregistrée dans le journal d’audit.</Typography.Paragraph>
      <Input.TextArea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={255} placeholder="Motif (obligatoire)" aria-label="Motif de l’annulation" />
      {cancel.error && <Alert type="error" title={getErrorMessage(cancel.error)} showIcon className="mt-3" />}
    </Modal>
  )
}

interface ReturnLineState {
  quantity: string | null
  restock: boolean
}

/** Retour client : quantités rendues par ligne (jamais plus que vendu), remise en stock ou non, remboursement. */
function SaleReturnModal({ sale, onCancel, onDone }: { sale: Sale; onCancel: () => void; onDone: (message: string) => void }) {
  const { data: methods = [] } = usePaymentMethods()
  const returnable = (sale.lines ?? []).filter((line) => Number(line.quantity) > Number(line.returnedQuantity))
  const [lines, setLines] = useState<Record<string, ReturnLineState>>({})
  const [reason, setReason] = useState('')
  const [refundTo, setRefundTo] = useState<'method' | 'customer_account'>('method')
  const [chosenMethodId, setRefundMethodId] = useState<string | undefined>()
  // Par défaut les espèces, dès que la liste des moyens de paiement est arrivée
  const refundMethodId = chosenMethodId ?? methods.find((method) => method.type === 'cash')?.id
  const [formError, setFormError] = useState<string | null>(null)
  const key = useRef(newIdempotencyKey())

  const save = useMutation({
    mutationFn: () =>
      posService.createSaleReturn(
        {
          saleId: sale.id,
          reason: reason.trim(),
          lines: Object.entries(lines)
            .filter(([, line]) => line.quantity && Number(line.quantity) > 0)
            .map(([saleLineId, line]) => ({ saleLineId, quantity: line.quantity!, restock: line.restock })),
          refundTo,
          ...(refundTo === 'method' && { refundMethodId }),
        },
        key.current,
      ),
    onSuccess: ({ return: created }) => onDone(`Retour ${created.number} enregistré`),
  })

  function submit() {
    setFormError(null)
    const chosen = Object.values(lines).filter((line) => line.quantity && Number(line.quantity) > 0)
    if (chosen.length === 0) return setFormError('Indiquez au moins une quantité retournée')
    for (const line of returnable) {
      const entry = lines[line.id]
      if (entry?.quantity && Number(entry.quantity) > Number(line.quantity) - Number(line.returnedQuantity)) {
        return setFormError(`« ${line.product.name} » : quantité retournable dépassée`)
      }
    }
    if (reason.trim().length < 3) return setFormError('Indiquez le motif du retour')
    if (refundTo === 'method' && !refundMethodId) return setFormError('Choisissez le moyen de remboursement')
    save.mutate()
  }

  const entry = (id: string): ReturnLineState => lines[id] ?? { quantity: null, restock: true }

  return (
    <Modal open title={`Retour sur la vente ${sale.number}`} okText="Enregistrer le retour" cancelText="Annuler" onOk={submit} onCancel={onCancel} confirmLoading={save.isPending} width={720}>
      <Table<SaleLine>
        rowKey="id"
        size="small"
        pagination={false}
        dataSource={returnable}
        columns={[
          { title: 'Produit', key: 'product', render: (_, line) => line.product.name },
          { title: 'Retournable', key: 'returnable', width: 110, align: 'right', render: (_, line) => formatQuantity(String(Number(line.quantity) - Number(line.returnedQuantity))) },
          {
            title: 'Rendu',
            key: 'quantity',
            width: 130,
            render: (_, line) => (
              <QuantityInput
                size="small"
                allowsDecimal
                value={entry(line.id).quantity}
                onChange={(quantity) => setLines((current) => ({ ...current, [line.id]: { ...entry(line.id), quantity } }))}
                aria-label={`Quantité rendue de ${line.product.name}`}
              />
            ),
          },
          {
            title: 'Remis en stock',
            key: 'restock',
            width: 130,
            render: (_, line) => (
              <Switch
                size="small"
                checked={entry(line.id).restock}
                onChange={(restock) => setLines((current) => ({ ...current, [line.id]: { ...entry(line.id), restock } }))}
                aria-label={`Remettre en stock ${line.product.name}`}
              />
            ),
          },
        ]}
      />
      <Form layout="vertical" component="div" className="mt-4">
        <Form.Item label="Motif">
          <Input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={255} placeholder="Article défectueux, erreur de taille…" aria-label="Motif du retour" />
        </Form.Item>
        <Form.Item label="Remboursement">
          <Segmented<'method' | 'customer_account'>
            value={refundTo}
            onChange={setRefundTo}
            options={[
              { value: 'method', label: 'Rendre l’argent' },
              { value: 'customer_account', label: 'Au compte du client', disabled: !sale.customer },
            ]}
            aria-label="Remboursement"
          />
        </Form.Item>
        {refundTo === 'method' && (
          <Form.Item label="Moyen de remboursement" extra="En espèces, l’argent sort du tiroir de votre caisse ouverte.">
            <Select value={refundMethodId} onChange={setRefundMethodId} options={methods.map((method) => ({ value: method.id, label: method.name }))} aria-label="Moyen de remboursement" />
          </Form.Item>
        )}
      </Form>
      {(formError || save.error) && <Alert type="error" title={formError ?? getErrorMessage(save.error)} showIcon />}
    </Modal>
  )
}

interface SaleDetailDrawerProps {
  id: string
  onClose: () => void
  onChanged: (message: string) => void
  onShowTicket: (saleId: string) => void
}

/** Détail d'une vente : lignes, paiements ; annulation et retour (permission « annuler / retour »). */
export function SaleDetailDrawer({ id, onClose, onChanged, onShowTicket }: SaleDetailDrawerProps) {
  const canRefund = usePermission('sales.cancel_refund')
  const shopName = useShopName()
  const [dialog, setDialog] = useState<'cancel' | 'return' | null>(null)
  const { data: sale, error, refetch } = useQuery({
    queryKey: queryKeys.pos.sale(id),
    queryFn: async () => (await posService.getSale(id)).sale,
  })

  const done = (text: string) => {
    setDialog(null)
    void refetch()
    onChanged(text)
  }
  const hasReturnable = (sale?.lines ?? []).some((line) => Number(line.quantity) > Number(line.returnedQuantity))
  const hasReturns = (sale?.lines ?? []).some((line) => Number(line.returnedQuantity) > 0)

  return (
    <Drawer
      open
      title={sale ? `Vente ${sale.number}` : 'Vente'}
      size={720}
      onClose={onClose}
      footer={
        sale && (
          <div className="flex flex-wrap justify-end gap-2">
            <Button icon={<PrinterOutlined />} onClick={() => onShowTicket(sale.id)}>
              Ticket
            </Button>
            {canRefund && sale.status === 'completed' && (
              <>
                {/* Une vente déjà en partie retournée ne s'annule plus : on fait un retour pour le reste */}
                {!hasReturns && (
                  <Button danger onClick={() => setDialog('cancel')}>
                    Annuler la vente
                  </Button>
                )}
                {hasReturnable && (
                  <Button type="primary" onClick={() => setDialog('return')}>
                    Retour client
                  </Button>
                )}
              </>
            )}
          </div>
        )
      }
    >
      {error && <Alert type="error" title={getErrorMessage(error)} showIcon />}
      {!sale ? (
        !error && <Skeleton active />
      ) : (
        <div className="flex flex-col gap-4">
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Date">{formatDateTime(sale.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="Boutique">{shopName(sale.shopId)}</Descriptions.Item>
            <Descriptions.Item label="État">{sale.status === 'cancelled' ? <Tag color="red">Annulée</Tag> : <Tag color="green">Validée</Tag>}</Descriptions.Item>
            {sale.cancelReason && <Descriptions.Item label="Motif d’annulation">{sale.cancelReason}</Descriptions.Item>}
            {sale.customer && <Descriptions.Item label="Client">{sale.customer.name}</Descriptions.Item>}
            <Descriptions.Item label="Total">
              <Money value={sale.total} className="font-semibold" />
            </Descriptions.Item>
            {Number(sale.balanceDue) > 0 && (
              <Descriptions.Item label="Reste dû (crédit)">
                <Money value={sale.balanceDue} />
              </Descriptions.Item>
            )}
          </Descriptions>
          <Table<SaleLine>
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={sale.lines ?? []}
            columns={[
              { title: 'Produit', key: 'product', render: (_, line) => line.product.name },
              { title: 'Quantité', dataIndex: 'quantity', align: 'right', render: (value: string) => formatQuantity(value) },
              { title: 'Prix', dataIndex: 'unitPrice', align: 'right', responsive: ['md'], render: (value: string) => <Money value={value} /> },
              { title: 'Total', dataIndex: 'lineTotal', align: 'right', render: (value: string) => <Money value={value} /> },
              {
                title: 'Retourné',
                dataIndex: 'returnedQuantity',
                align: 'right',
                render: (value: string) => (Number(value) > 0 ? <Tag color="orange">{formatQuantity(value)}</Tag> : '—'),
              },
            ]}
          />
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={sale.payments ?? []}
            locale={{ emptyText: 'Aucun paiement (vente à crédit)' }}
            columns={[
              { title: 'Paiement', key: 'method', render: (_, payment) => payment.paymentMethod.name },
              { title: 'Montant', dataIndex: 'amount', align: 'right', render: (value: string) => <Money value={value} /> },
            ]}
          />
        </div>
      )}
      {sale && dialog === 'cancel' && <CancelSaleModal sale={sale} onCancel={() => setDialog(null)} onDone={done} />}
      {sale && dialog === 'return' && <SaleReturnModal sale={sale} onCancel={() => setDialog(null)} onDone={done} />}
    </Drawer>
  )
}
