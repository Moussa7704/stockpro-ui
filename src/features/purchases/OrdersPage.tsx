import { PlusOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Select, Table, Tag, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { useState } from 'react'
import { Money } from '../../components/Money'
import { ORDER_STATUS } from '../../constants/purchases'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage } from '../../services/api'
import type { OrderStatus, PurchaseOrder } from '../../types/purchases'
import { formatDate, formatDateTime } from '../../utils/format'
import { useShopName } from '../stock/queries'
import { OrderDetailDrawer, OrderFormDrawer } from './OrderDrawers'
import { useOrders } from './queries'
import { ReceiptFormDrawer } from './ReceiptDrawers'
import { SupplierSelect } from './SupplierSelect'
import { useShopFilter } from '../../hook/useActiveShop'
import { usePage } from '../../hook/usePage'

const PAGE_SIZE = 20

/** Bons de commande fournisseurs : brouillon → envoyée → réceptions (partielles) → reçue ou clôturée. */
export function OrdersPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const shopName = useShopName()
  const [status, setStatus] = useState<OrderStatus | undefined>()
  const [supplierId, setSupplierId] = useState<string | undefined>()
  const shopId = useShopFilter()
  const [page, setPage] = usePage(shopId)
  // undefined : fermé ; null : nouvelle commande ; commande : modification du brouillon
  const [formOrder, setFormOrder] = useState<PurchaseOrder | null | undefined>(undefined)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [receivingOrder, setReceivingOrder] = useState<PurchaseOrder | null>(null)
  const { data, isFetching, error } = useOrders({ page, pageSize: PAGE_SIZE, status, supplierId, shopId })

  const refresh = (withStock = false) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all })
    if (withStock) void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
  }

  const filter = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value)
    setPage(1)
  }

  const columns: TableColumnsType<PurchaseOrder> = [
    { title: 'Numéro', dataIndex: 'number', render: (value: string) => <Typography.Text strong>{value}</Typography.Text> },
    { title: 'Fournisseur', key: 'supplier', render: (_, order) => order.supplier?.name },
    { title: 'Boutique', key: 'shop', width: 170, responsive: ['lg'], render: (_, order) => shopName(order.shopId) },
    { title: 'Créée le', dataIndex: 'createdAt', width: 140, responsive: ['md'], render: (value: string) => formatDateTime(value) },
    { title: 'Livraison prévue', dataIndex: 'expectedAt', width: 140, responsive: ['xl'], render: (value: string | null) => (value ? formatDate(value) : '—') },
    { title: 'Total', dataIndex: 'total', width: 140, align: 'right', render: (value: string) => <Money value={value} /> },
    { title: 'État', dataIndex: 'status', width: 170, render: (value: OrderStatus) => <Tag color={ORDER_STATUS[value].color}>{ORDER_STATUS[value].label}</Tag> },
    {
      title: '',
      key: 'actions',
      width: 90,
      render: (_, order) => (
        <Button size="small" onClick={() => setDetailId(order.id)} aria-label={`Ouvrir ${order.number}`}>
          Ouvrir
        </Button>
      ),
    },
  ]

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Typography.Title level={2} className="mb-0">
          Bons de commande
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setFormOrder(null)}>
          Nouveau bon de commande
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SupplierSelect allowClear value={supplierId} onChange={filter(setSupplierId)} placeholder="Tous les fournisseurs" className="w-60" />
        <Select
          allowClear
          value={status}
          onChange={(value) => filter(setStatus)(value ?? undefined)}
          placeholder="Tous les états"
          options={Object.entries(ORDER_STATUS).map(([value, { label }]) => ({ value, label }))}
          className="w-52"
          aria-label="Filtrer par état"
        />
      </div>

      {error && <Alert type="error" title={getErrorMessage(error)} showIcon />}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<PurchaseOrder>
          rowKey="id"
          columns={columns}
          dataSource={data?.items ?? []}
          loading={isFetching}
          scroll={{ x: 760 }}
          pagination={{ current: page, pageSize: PAGE_SIZE, total: data?.total ?? 0, onChange: setPage, showSizeChanger: false, hideOnSinglePage: true }}
          locale={{ emptyText: 'Aucun bon de commande' }}
        />
      </Card>

      {formOrder !== undefined && (
        <OrderFormDrawer
          key={formOrder?.id ?? 'new'}
          order={formOrder}
          onClose={() => setFormOrder(undefined)}
          onSaved={(order, created) => {
            refresh()
            setFormOrder(undefined)
            setDetailId(order.id)
            message.success(created ? `Bon de commande ${order.number} créé` : `Bon de commande ${order.number} mis à jour`)
          }}
        />
      )}
      {detailId && (
        <OrderDetailDrawer
          key={detailId}
          id={detailId}
          onClose={() => setDetailId(null)}
          onChanged={(text) => {
            refresh()
            message.success(text)
          }}
          onEdit={(order) => setFormOrder(order)}
          onReceive={(order) => setReceivingOrder(order)}
        />
      )}
      {receivingOrder && (
        <ReceiptFormDrawer
          order={receivingOrder}
          onClose={() => setReceivingOrder(null)}
          onSaved={(receipt, validated) => {
            refresh(validated)
            setReceivingOrder(null)
            message.success(validated ? `Réception ${receipt.number} validée : stock mis à jour` : `Réception ${receipt.number} enregistrée en brouillon`)
          }}
        />
      )}
    </div>
  )
}
