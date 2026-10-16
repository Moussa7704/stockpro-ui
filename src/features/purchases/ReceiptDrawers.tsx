import { useMutation, useQuery } from '@tanstack/react-query'
import { Alert, Button, Descriptions, Drawer, Form, Input, Popconfirm, Select, Skeleton, Table, Tag } from 'antd'
import { useRef, useState } from 'react'
import { Money } from '../../components/Money'
import { DOCUMENT_STATUS } from '../../constants/purchases'
import { useActiveShop } from '../../hook/useActiveShop'
import { usePermission } from '../../hook/usePermission'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage, newIdempotencyKey } from '../../services/api'
import * as purchasesService from '../../services/purchases.service'
import type { GoodsReceipt, PurchaseOrder } from '../../types/purchases'
import { formatDateTime, formatQuantity } from '../../utils/format'
import { useShopName } from '../stock/queries'
import { PricedLinesEditor } from './PricedLinesEditor'
import { validateLines, type PricedLine } from './pricedLines'
import { useSupplierName } from './queries'
import { SupplierSelect } from './SupplierSelect'

interface ReceiptFormDrawerProps {
  /** Réception d'une commande : fournisseur, boutique et lignes repris (reste à recevoir) */
  order?: PurchaseOrder
  onClose: () => void
  onSaved: (receipt: GoodsReceipt, validated: boolean) => void
}

/** Saisie d'une réception (bon de livraison du fournisseur), liée ou non à une commande. */
export function ReceiptFormDrawer({ order, onClose, onSaved }: ReceiptFormDrawerProps) {
  const { shops, activeShop } = useActiveShop()
  const [shopId, setShopId] = useState<string | undefined>(order?.shopId ?? activeShop?.id)
  const [supplierId, setSupplierId] = useState<string | undefined>(order?.supplierId)
  const [supplierReference, setSupplierReference] = useState('')
  const [lines, setLines] = useState<PricedLine[]>(
    (order?.lines ?? [])
      .filter((line) => Number(line.quantityRemaining ?? 0) > 0)
      .map((line) => ({
        product: line.product,
        quantity: line.quantityRemaining ?? null,
        unitCost: line.unitCost,
        orderLineId: line.id,
        remaining: line.quantityRemaining,
      })),
  )
  const [formError, setFormError] = useState<string | null>(null)
  // Une clé par réception saisie : rejouer la validation après une coupure ne double pas l'entrée
  const validationKey = useRef(newIdempotencyKey())
  // Réception déjà créée lors d'un essai précédent (ex. validation coupée par le réseau) :
  // on ne la recrée pas, on rejoue seulement la validation
  const created = useRef<GoodsReceipt | null>(null)

  const save = useMutation({
    mutationFn: async (validate: boolean) => {
      const receipt = created.current ?? (await purchasesService.createReceipt({
        shopId: shopId!,
        supplierId: supplierId!,
        ...(order && { orderId: order.id }),
        supplierReference: supplierReference.trim() || null,
        lines: lines.map((line) => ({
          productId: line.product.id,
          quantity: line.quantity!,
          unitCost: line.unitCost!,
          ...(line.orderLineId && { orderLineId: line.orderLineId }),
        })),
      })).receipt
      created.current = receipt
      if (!validate) return { receipt, validated: false }
      return { receipt: (await purchasesService.validateReceipt(receipt.id, validationKey.current)).receipt, validated: true }
    },
    onSuccess: ({ receipt, validated }) => onSaved(receipt, validated),
  })

  function submit(validate: boolean) {
    setFormError(null)
    if (!shopId || !supplierId) return setFormError('Choisissez la boutique et le fournisseur')
    const error = validateLines(lines)
    if (error) return setFormError(error)
    if (lines.some((line) => line.remaining !== undefined && Number(line.quantity) > Number(line.remaining))) {
      return setFormError('Une quantité dépasse le reste à recevoir de la commande')
    }
    save.mutate(validate)
  }

  return (
    <Drawer
      open
      title={order ? `Réception de la commande ${order.number}` : 'Nouvelle réception'}
      size={820}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={onClose}>Annuler</Button>
          <Button onClick={() => submit(false)} loading={save.isPending && save.variables === false}>
            Enregistrer le brouillon
          </Button>
          <Popconfirm
            title="Valider la réception ?"
            description="Le stock entre dans la boutique et le coût moyen est recalculé."
            okText="Valider"
            cancelText="Non"
            onConfirm={() => submit(true)}
          >
            <Button type="primary" loading={save.isPending && save.variables === true}>
              Valider la réception
            </Button>
          </Popconfirm>
        </div>
      }
    >
      <Form layout="vertical" requiredMark={false} component="div">
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-3">
          <Form.Item label="Boutique">
            <Select value={shopId} onChange={setShopId} disabled={!!order} options={shops.map((shop) => ({ value: shop.id, label: shop.name }))} aria-label="Boutique" />
          </Form.Item>
          <Form.Item label="Fournisseur">{order ? <Input value={order.supplier?.name} disabled /> : <SupplierSelect value={supplierId} onChange={setSupplierId} />}</Form.Item>
          <Form.Item label="N° de bon de livraison">
            <Input value={supplierReference} onChange={(event) => setSupplierReference(event.target.value)} maxLength={60} placeholder="BL-4521" aria-label="N° de bon de livraison" />
          </Form.Item>
        </div>
      </Form>
      <PricedLinesEditor lines={lines} onChange={setLines} allowAdd={!order} quantityLabel="Quantité reçue" />
      {(formError || save.error) && <Alert type="error" title={formError ?? getErrorMessage(save.error)} showIcon className="mt-4" />}
    </Drawer>
  )
}

/** Détail d'une réception ; un brouillon se valide (entrée en stock) ou s'annule. */
export function ReceiptDetailDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: (message: string) => void }) {
  const canPurchase = usePermission('purchases.manage')
  const shopName = useShopName()
  const supplierName = useSupplierName()
  const validationKey = useRef(newIdempotencyKey())
  const { data: receipt, error, refetch } = useQuery({
    queryKey: queryKeys.purchases.receipt(id),
    queryFn: async () => (await purchasesService.getReceipt(id)).receipt,
  })

  const action = useMutation({
    mutationFn: (kind: 'validate' | 'cancel') =>
      kind === 'validate' ? purchasesService.validateReceipt(id, validationKey.current) : purchasesService.cancelReceipt(id),
    onSuccess: ({ receipt: updated }, kind) => {
      void refetch()
      onChanged(kind === 'validate' ? `Réception ${updated.number} validée : stock mis à jour` : `Réception ${updated.number} annulée`)
    },
  })

  return (
    <Drawer
      open
      title={receipt ? `Réception ${receipt.number}` : 'Réception'}
      size={720}
      onClose={onClose}
      footer={
        receipt?.status === 'draft' &&
        canPurchase && (
          <div className="flex justify-end gap-2">
            <Popconfirm title="Annuler cette réception ?" okText="Annuler la réception" okButtonProps={{ danger: true }} cancelText="Non" onConfirm={() => action.mutate('cancel')}>
              <Button danger loading={action.isPending && action.variables === 'cancel'}>
                Annuler la réception
              </Button>
            </Popconfirm>
            <Popconfirm title="Valider la réception ?" description="Le stock entre et le coût moyen est recalculé." okText="Valider" cancelText="Non" onConfirm={() => action.mutate('validate')}>
              <Button type="primary" loading={action.isPending && action.variables === 'validate'}>
                Valider la réception
              </Button>
            </Popconfirm>
          </div>
        )
      }
    >
      {(error || action.error) && <Alert type="error" title={getErrorMessage(error ?? action.error)} showIcon className="mb-4" />}
      {!receipt ? (
        !error && <Skeleton active />
      ) : (
        <div className="flex flex-col gap-4">
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Fournisseur">{supplierName(receipt.supplierId)}</Descriptions.Item>
            <Descriptions.Item label="Boutique">{shopName(receipt.shopId)}</Descriptions.Item>
            <Descriptions.Item label="État">
              <Tag color={DOCUMENT_STATUS[receipt.status].color}>{DOCUMENT_STATUS[receipt.status].label}</Tag>
            </Descriptions.Item>
            {receipt.supplierReference && <Descriptions.Item label="Bon de livraison">{receipt.supplierReference}</Descriptions.Item>}
            <Descriptions.Item label="Saisie le">{formatDateTime(receipt.createdAt)}</Descriptions.Item>
            {receipt.validatedAt && <Descriptions.Item label="Validée le">{formatDateTime(receipt.validatedAt)}</Descriptions.Item>}
            <Descriptions.Item label="Total">
              <Money value={receipt.total} />
            </Descriptions.Item>
          </Descriptions>
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={receipt.lines ?? []}
            columns={[
              { title: 'Produit', key: 'product', render: (_, line) => line.product.name },
              { title: 'Quantité', dataIndex: 'quantity', align: 'right', render: (value: string) => formatQuantity(value) },
              { title: 'Coût unitaire', dataIndex: 'unitCost', align: 'right', render: (value: string) => <Money value={value} /> },
              { title: 'Total', dataIndex: 'lineTotal', align: 'right', render: (value: string) => <Money value={value} /> },
            ]}
          />
        </div>
      )}
    </Drawer>
  )
}
