import { PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Descriptions, Drawer, Form, Input, Popconfirm, Select, Skeleton, Table, Tag, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { useRef, useState } from 'react'
import { Money } from '../../components/Money'
import { DOCUMENT_STATUS } from '../../constants/purchases'
import { useActiveShop, useShopFilter } from '../../hook/useActiveShop'
import { usePage } from '../../hook/usePage'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage, newIdempotencyKey } from '../../services/api'
import * as purchasesService from '../../services/purchases.service'
import type { ReceiptStatus, SupplierReturn } from '../../types/purchases'
import { formatDateTime, formatQuantity } from '../../utils/format'
import { useShopName } from '../stock/queries'
import { PricedLinesEditor } from './PricedLinesEditor'
import { validateLines, type PricedLine } from './pricedLines'
import { useReturns, useSupplierName } from './queries'
import { SupplierSelect } from './SupplierSelect'

const PAGE_SIZE = 20

function ReturnFormDrawer({ onClose, onSaved }: { onClose: () => void; onSaved: (supplierReturn: SupplierReturn) => void }) {
  const { shops, activeShop } = useActiveShop()
  const [shopId, setShopId] = useState<string | undefined>(activeShop?.id)
  const [supplierId, setSupplierId] = useState<string | undefined>()
  const [reason, setReason] = useState('')
  const [lines, setLines] = useState<PricedLine[]>([])
  const [formError, setFormError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: () =>
      purchasesService.createReturn({
        shopId: shopId!,
        supplierId: supplierId!,
        reason: reason.trim(),
        lines: lines.map((line) => ({ productId: line.product.id, quantity: line.quantity!, ...(line.unitCost ? { unitCost: line.unitCost } : {}) })),
      }),
    onSuccess: ({ return: created }) => onSaved(created),
  })

  function submit() {
    setFormError(null)
    if (!shopId || !supplierId) return setFormError('Choisissez la boutique et le fournisseur')
    if (reason.trim().length < 3) return setFormError('Indiquez le motif du retour')
    const error = validateLines(lines, false)
    if (error) return setFormError(error)
    save.mutate()
  }

  return (
    <Drawer
      open
      title="Nouveau retour fournisseur"
      size={820}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Annuler</Button>
          <Button type="primary" onClick={submit} loading={save.isPending}>
            Préparer le retour
          </Button>
        </div>
      }
    >
      <Form layout="vertical" requiredMark={false} component="div">
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Form.Item label="Boutique">
            <Select value={shopId} onChange={setShopId} options={shops.map((shop) => ({ value: shop.id, label: shop.name }))} aria-label="Boutique" />
          </Form.Item>
          <Form.Item label="Fournisseur">
            <SupplierSelect value={supplierId} onChange={setSupplierId} />
          </Form.Item>
        </div>
        <Form.Item label="Motif">
          <Input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={255} placeholder="Produits abîmés à la livraison, erreur de référence…" aria-label="Motif" />
        </Form.Item>
      </Form>
      <PricedLinesEditor lines={lines} onChange={setLines} costRequired={false} quantityLabel="Quantité retournée" />
      {(formError || save.error) && <Alert type="error" title={formError ?? getErrorMessage(save.error)} showIcon className="mt-4" />}
    </Drawer>
  )
}

function ReturnDetailDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: (message: string) => void }) {
  const shopName = useShopName()
  const supplierName = useSupplierName()
  const validationKey = useRef(newIdempotencyKey())
  const { data: supplierReturn, error, refetch } = useQuery({
    queryKey: queryKeys.purchases.return(id),
    queryFn: async () => (await purchasesService.getReturn(id)).return,
  })
  const action = useMutation({
    mutationFn: (kind: 'validate' | 'cancel') => (kind === 'validate' ? purchasesService.validateReturn(id, validationKey.current) : purchasesService.cancelReturn(id)),
    onSuccess: ({ return: updated }, kind) => {
      void refetch()
      onChanged(kind === 'validate' ? `Retour ${updated.number} validé : stock mis à jour` : `Retour ${updated.number} annulé`)
    },
  })

  return (
    <Drawer
      open
      title={supplierReturn ? `Retour ${supplierReturn.number}` : 'Retour fournisseur'}
      size={720}
      onClose={onClose}
      footer={
        supplierReturn?.status === 'draft' && (
          <div className="flex justify-end gap-2">
            <Popconfirm title="Annuler ce retour ?" okText="Annuler le retour" okButtonProps={{ danger: true }} cancelText="Non" onConfirm={() => action.mutate('cancel')}>
              <Button danger loading={action.isPending && action.variables === 'cancel'}>
                Annuler le retour
              </Button>
            </Popconfirm>
            <Popconfirm title="Valider le retour ?" description="Les produits sortent du stock de la boutique." okText="Valider" cancelText="Non" onConfirm={() => action.mutate('validate')}>
              <Button type="primary" loading={action.isPending && action.variables === 'validate'}>
                Valider le retour
              </Button>
            </Popconfirm>
          </div>
        )
      }
    >
      {(error || action.error) && <Alert type="error" title={getErrorMessage(error ?? action.error)} showIcon className="mb-4" />}
      {!supplierReturn ? (
        !error && <Skeleton active />
      ) : (
        <div className="flex flex-col gap-4">
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Fournisseur">{supplierName(supplierReturn.supplierId)}</Descriptions.Item>
            <Descriptions.Item label="Boutique">{shopName(supplierReturn.shopId)}</Descriptions.Item>
            <Descriptions.Item label="Motif">{supplierReturn.reason}</Descriptions.Item>
            <Descriptions.Item label="État">
              <Tag color={DOCUMENT_STATUS[supplierReturn.status].color}>{DOCUMENT_STATUS[supplierReturn.status].label}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Saisi le">{formatDateTime(supplierReturn.createdAt)}</Descriptions.Item>
            {supplierReturn.status === 'validated' && (
              <Descriptions.Item label="Valeur">
                <Money value={supplierReturn.total} />
              </Descriptions.Item>
            )}
          </Descriptions>
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={supplierReturn.lines ?? []}
            columns={[
              { title: 'Produit', key: 'product', render: (_, line) => line.product.name },
              { title: 'Quantité', dataIndex: 'quantity', align: 'right', render: (value: string) => formatQuantity(value) },
              {
                title: 'Coût unitaire',
                dataIndex: 'unitCost',
                align: 'right',
                render: (value: string | null) => (value ? <Money value={value} /> : <Typography.Text type="secondary">coût moyen</Typography.Text>),
              },
            ]}
          />
        </div>
      )}
    </Drawer>
  )
}

/** Retours fournisseurs : la validation fait sortir le stock vers le fournisseur. */
export function ReturnsPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const supplierName = useSupplierName()
  const [status, setStatus] = useState<ReceiptStatus | undefined>()
  const [supplierId, setSupplierId] = useState<string | undefined>()
  const shopId = useShopFilter()
  const [page, setPage] = usePage(shopId)
  const [creating, setCreating] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const { data, isFetching, error } = useReturns({ page, pageSize: PAGE_SIZE, status, supplierId, shopId })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all })
    void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
  }
  const filter = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value)
    setPage(1)
  }

  const columns: TableColumnsType<SupplierReturn> = [
    { title: 'Numéro', dataIndex: 'number', render: (value: string) => <Typography.Text strong>{value}</Typography.Text> },
    { title: 'Fournisseur', key: 'supplier', render: (_, supplierReturn) => supplierName(supplierReturn.supplierId) },
    { title: 'Motif', dataIndex: 'reason', responsive: ['lg'], ellipsis: true },
    { title: 'Saisi le', dataIndex: 'createdAt', width: 140, responsive: ['md'], render: (value: string) => formatDateTime(value) },
    { title: 'État', dataIndex: 'status', width: 120, render: (value: ReceiptStatus) => <Tag color={DOCUMENT_STATUS[value].color}>{DOCUMENT_STATUS[value].label}</Tag> },
    {
      title: '',
      key: 'actions',
      width: 90,
      render: (_, supplierReturn) => (
        <Button size="small" type={supplierReturn.status === 'draft' ? 'primary' : 'default'} onClick={() => setDetailId(supplierReturn.id)} aria-label={`Ouvrir ${supplierReturn.number}`}>
          Ouvrir
        </Button>
      ),
    },
  ]

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Typography.Title level={2} className="mb-0">
          Retours fournisseurs
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
          Nouveau retour
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SupplierSelect allowClear value={supplierId} onChange={filter(setSupplierId)} placeholder="Tous les fournisseurs" className="w-60" />
        <Select
          allowClear
          value={status}
          onChange={(value) => filter(setStatus)(value ?? undefined)}
          placeholder="Tous les états"
          options={Object.entries(DOCUMENT_STATUS).map(([value, { label }]) => ({ value, label }))}
          className="w-44"
          aria-label="Filtrer par état"
        />
      </div>

      {error && <Alert type="error" title={getErrorMessage(error)} showIcon />}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<SupplierReturn>
          rowKey="id"
          columns={columns}
          dataSource={data?.items ?? []}
          loading={isFetching}
          scroll={{ x: 680 }}
          pagination={{ current: page, pageSize: PAGE_SIZE, total: data?.total ?? 0, onChange: setPage, showSizeChanger: false, hideOnSinglePage: true }}
          locale={{ emptyText: 'Aucun retour fournisseur' }}
        />
      </Card>

      {creating && (
        <ReturnFormDrawer
          onClose={() => setCreating(false)}
          onSaved={(created) => {
            refresh()
            setCreating(false)
            setDetailId(created.id)
            message.success(`Retour ${created.number} préparé : validez-le quand la marchandise part`)
          }}
        />
      )}
      {detailId && (
        <ReturnDetailDrawer
          key={detailId}
          id={detailId}
          onClose={() => setDetailId(null)}
          onChanged={(text) => {
            refresh()
            message.success(text)
          }}
        />
      )}
    </div>
  )
}
