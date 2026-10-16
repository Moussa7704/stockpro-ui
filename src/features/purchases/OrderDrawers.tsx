import { useMutation, useQuery } from '@tanstack/react-query'
import { Alert, Button, DatePicker, Descriptions, Drawer, Form, Input, Popconfirm, Select, Skeleton, Table, Tag } from 'antd'
import dayjs from 'dayjs'
import { useState } from 'react'
import { Money } from '../../components/Money'
import { ORDER_STATUS } from '../../constants/purchases'
import { useActiveShop } from '../../hook/useActiveShop'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage } from '../../services/api'
import * as purchasesService from '../../services/purchases.service'
import type { PurchaseOrder, PurchaseOrderLine } from '../../types/purchases'
import { formatDate, formatDateTime, formatQuantity } from '../../utils/format'
import { useShopName } from '../stock/queries'
import { PricedLinesEditor } from './PricedLinesEditor'
import { validateLines, type PricedLine } from './pricedLines'
import { SupplierSelect } from './SupplierSelect'

/** Création d'un bon de commande, ou modification d'un brouillon (date prévue, lignes, commentaire). */
export function OrderFormDrawer({ order, onClose, onSaved }: { order: PurchaseOrder | null; onClose: () => void; onSaved: (order: PurchaseOrder, created: boolean) => void }) {
  const { shops, activeShop } = useActiveShop()
  const isEdit = order !== null
  const [shopId, setShopId] = useState<string | undefined>(order?.shopId ?? activeShop?.id)
  const [supplierId, setSupplierId] = useState<string | undefined>(order?.supplierId)
  const [expectedAt, setExpectedAt] = useState<string | null>(order?.expectedAt ?? null)
  const [notes, setNotes] = useState(order?.notes ?? '')
  const [lines, setLines] = useState<PricedLine[]>(
    (order?.lines ?? []).map((line) => ({ product: line.product, quantity: line.quantityOrdered, unitCost: line.unitCost })),
  )
  const [formError, setFormError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: () => {
      const payloadLines = lines.map((line) => ({ productId: line.product.id, quantity: line.quantity!, unitCost: line.unitCost! }))
      return isEdit
        ? purchasesService.updateOrder(order.id, { expectedAt, notes: notes.trim() || null, lines: payloadLines })
        : purchasesService.createOrder({ shopId: shopId!, supplierId: supplierId!, expectedAt, notes: notes.trim() || null, lines: payloadLines })
    },
    onSuccess: ({ order: saved }) => onSaved(saved, !isEdit),
  })

  function submit() {
    setFormError(null)
    if (!shopId || !supplierId) return setFormError('Choisissez la boutique et le fournisseur')
    const error = validateLines(lines)
    if (error) return setFormError(error)
    save.mutate()
  }

  return (
    <Drawer
      open
      title={isEdit ? `Modifier la commande ${order.number}` : 'Nouveau bon de commande'}
      size={820}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Annuler</Button>
          <Button type="primary" onClick={submit} loading={save.isPending}>
            {isEdit ? 'Enregistrer' : 'Créer le bon de commande'}
          </Button>
        </div>
      }
    >
      <Form layout="vertical" requiredMark={false} component="div">
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-3">
          <Form.Item label="Boutique de livraison">
            <Select value={shopId} onChange={setShopId} disabled={isEdit} options={shops.map((shop) => ({ value: shop.id, label: shop.name }))} aria-label="Boutique de livraison" />
          </Form.Item>
          <Form.Item label="Fournisseur">
            {isEdit ? <Input value={order.supplier?.name} disabled /> : <SupplierSelect value={supplierId} onChange={setSupplierId} />}
          </Form.Item>
          <Form.Item label="Livraison prévue le">
            <DatePicker
              value={expectedAt ? dayjs(expectedAt) : null}
              onChange={(date) => setExpectedAt(date ? date.format('YYYY-MM-DD') : null)}
              format="DD/MM/YYYY"
              className="w-full"
              aria-label="Livraison prévue le"
            />
          </Form.Item>
        </div>
      </Form>
      <PricedLinesEditor lines={lines} onChange={setLines} quantityLabel="Quantité commandée" />
      <Input.TextArea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Commentaire pour le fournisseur (facultatif)" maxLength={2000} className="mt-4" aria-label="Commentaire" />
      {(formError || save.error) && <Alert type="error" title={formError ?? getErrorMessage(save.error)} showIcon className="mt-4" />}
    </Drawer>
  )
}

type OrderAction = 'send' | 'cancel' | 'close'

const ACTION_DONE: Record<OrderAction, string> = { send: 'envoyée', cancel: 'annulée', close: 'clôturée' }

interface OrderDetailDrawerProps {
  id: string
  onClose: () => void
  onChanged: (message: string) => void
  onEdit: (order: PurchaseOrder) => void
  onReceive: (order: PurchaseOrder) => void
}

/** Détail d'un bon de commande, reste à recevoir par ligne, et actions selon son état. */
export function OrderDetailDrawer({ id, onClose, onChanged, onEdit, onReceive }: OrderDetailDrawerProps) {
  const shopName = useShopName()
  const { data: order, error, refetch } = useQuery({
    queryKey: queryKeys.purchases.order(id),
    queryFn: async () => (await purchasesService.getOrder(id)).order,
  })

  const action = useMutation({
    mutationFn: (kind: OrderAction) =>
      kind === 'send' ? purchasesService.sendOrder(id) : kind === 'cancel' ? purchasesService.cancelOrder(id) : purchasesService.closeOrder(id),
    onSuccess: ({ order: updated }, kind) => {
      void refetch()
      onChanged(`Commande ${updated.number} ${ACTION_DONE[kind]}`)
    },
  })

  const status = order?.status
  const receivable = status === 'sent' || status === 'partially_received'

  return (
    <Drawer
      open
      title={order ? `Commande ${order.number}` : 'Commande'}
      size={760}
      onClose={onClose}
      footer={
        order && (
          <div className="flex flex-wrap justify-end gap-2">
            {(status === 'draft' || status === 'sent') && (
              <Popconfirm title="Annuler cette commande ?" okText="Annuler la commande" okButtonProps={{ danger: true }} cancelText="Non" onConfirm={() => action.mutate('cancel')}>
                <Button danger loading={action.isPending && action.variables === 'cancel'}>
                  Annuler la commande
                </Button>
              </Popconfirm>
            )}
            {status === 'partially_received' && (
              <Popconfirm title="Clôturer la commande ?" description="Le reste ne sera plus attendu." okText="Clôturer" cancelText="Non" onConfirm={() => action.mutate('close')}>
                <Button loading={action.isPending && action.variables === 'close'}>Clôturer</Button>
              </Popconfirm>
            )}
            {status === 'draft' && (
              <>
                <Button onClick={() => onEdit(order)}>Modifier</Button>
                <Popconfirm title="Envoyer la commande au fournisseur ?" description="Elle ne sera plus modifiable." okText="Envoyer" cancelText="Non" onConfirm={() => action.mutate('send')}>
                  <Button type="primary" loading={action.isPending && action.variables === 'send'}>
                    Envoyer
                  </Button>
                </Popconfirm>
              </>
            )}
            {receivable && (
              <Button type="primary" onClick={() => onReceive(order)}>
                Réceptionner
              </Button>
            )}
          </div>
        )
      }
    >
      {(error || action.error) && <Alert type="error" title={getErrorMessage(error ?? action.error)} showIcon className="mb-4" />}
      {!order ? (
        !error && <Skeleton active />
      ) : (
        <div className="flex flex-col gap-4">
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Fournisseur">{order.supplier?.name}</Descriptions.Item>
            <Descriptions.Item label="Boutique">{shopName(order.shopId)}</Descriptions.Item>
            <Descriptions.Item label="État">
              <Tag color={ORDER_STATUS[order.status].color}>{ORDER_STATUS[order.status].label}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Créée le">{formatDateTime(order.createdAt)}</Descriptions.Item>
            {order.expectedAt && <Descriptions.Item label="Livraison prévue">{formatDate(order.expectedAt)}</Descriptions.Item>}
            {order.notes && <Descriptions.Item label="Commentaire">{order.notes}</Descriptions.Item>}
            <Descriptions.Item label="Total">
              <Money value={order.total} className="font-semibold" />
            </Descriptions.Item>
          </Descriptions>
          <Table<PurchaseOrderLine>
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={order.lines ?? []}
            columns={[
              { title: 'Produit', key: 'product', render: (_, line) => line.product.name },
              { title: 'Commandé', dataIndex: 'quantityOrdered', align: 'right', render: (value: string) => formatQuantity(value) },
              { title: 'Reçu', dataIndex: 'quantityReceived', align: 'right', render: (value: string) => formatQuantity(value) },
              {
                title: 'Reste',
                dataIndex: 'quantityRemaining',
                align: 'right',
                render: (value: string | undefined) => (Number(value ?? 0) > 0 ? <span className="font-semibold text-orange-600">{formatQuantity(value)}</span> : '—'),
              },
              { title: 'Coût unitaire', dataIndex: 'unitCost', align: 'right', responsive: ['md'], render: (value: string) => <Money value={value} /> },
              { title: 'Total', dataIndex: 'lineTotal', align: 'right', render: (value: string) => <Money value={value} /> },
            ]}
          />
        </div>
      )}
    </Drawer>
  )
}
