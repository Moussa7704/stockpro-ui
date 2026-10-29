import { PlusOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Select, Table, Tag, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { useState } from 'react'
import { Money } from '../../components/Money'
import { DOCUMENT_STATUS } from '../../constants/purchases'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage } from '../../services/api'
import type { GoodsReceipt, ReceiptStatus } from '../../types/purchases'
import { formatDateTime } from '../../utils/format'
import { useReceipts, useSupplierName } from './queries'
import { ReceiptDetailDrawer, ReceiptFormDrawer } from './ReceiptDrawers'
import { SupplierSelect } from './SupplierSelect'
import { useShopFilter } from '../../hook/useActiveShop'
import { usePage } from '../../hook/usePage'

const PAGE_SIZE = 20

/** Réceptions de marchandise : seule la validation fait entrer le stock (et recalcule le coût moyen). */
export function ReceiptsPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const supplierName = useSupplierName()
  const [status, setStatus] = useState<ReceiptStatus | undefined>()
  const [supplierId, setSupplierId] = useState<string | undefined>()
  const shopId = useShopFilter()
  const [page, setPage] = usePage(shopId)
  const [creating, setCreating] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const { data, isFetching, error } = useReceipts({ page, pageSize: PAGE_SIZE, status, supplierId, shopId })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all })
    void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
  }
  const filter = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value)
    setPage(1)
  }

  const columns: TableColumnsType<GoodsReceipt> = [
    { title: 'Numéro', dataIndex: 'number', render: (value: string) => <Typography.Text strong>{value}</Typography.Text> },
    { title: 'Fournisseur', key: 'supplier', render: (_, receipt) => supplierName(receipt.supplierId) },
    { title: 'Bon de livraison', dataIndex: 'supplierReference', width: 150, responsive: ['lg'], render: (value: string | null) => value ?? '—' },
    { title: 'Saisie le', dataIndex: 'createdAt', width: 140, responsive: ['md'], render: (value: string) => formatDateTime(value) },
    { title: 'Total', dataIndex: 'total', width: 140, align: 'right', render: (value: string) => <Money value={value} /> },
    { title: 'État', dataIndex: 'status', width: 120, render: (value: ReceiptStatus) => <Tag color={DOCUMENT_STATUS[value].color}>{DOCUMENT_STATUS[value].label}</Tag> },
    {
      title: '',
      key: 'actions',
      width: 90,
      render: (_, receipt) => (
        <Button size="small" type={receipt.status === 'draft' ? 'primary' : 'default'} onClick={() => setDetailId(receipt.id)} aria-label={`Ouvrir ${receipt.number}`}>
          Ouvrir
        </Button>
      ),
    },
  ]

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Typography.Title level={2} className="mb-0">
          Réceptions
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
          Nouvelle réception
        </Button>
      </div>
      <Typography.Text type="secondary">Pour recevoir une commande, ouvrez-la dans « Bons de commande » puis « Réceptionner ».</Typography.Text>

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
        <Table<GoodsReceipt>
          rowKey="id"
          columns={columns}
          dataSource={data?.items ?? []}
          loading={isFetching}
          scroll={{ x: 700 }}
          pagination={{ current: page, pageSize: PAGE_SIZE, total: data?.total ?? 0, onChange: setPage, showSizeChanger: false, hideOnSinglePage: true }}
          locale={{ emptyText: 'Aucune réception' }}
        />
      </Card>

      {creating && (
        <ReceiptFormDrawer
          onClose={() => setCreating(false)}
          onSaved={(receipt, validated) => {
            refresh()
            setCreating(false)
            message.success(validated ? `Réception ${receipt.number} validée : stock mis à jour` : `Réception ${receipt.number} enregistrée en brouillon`)
          }}
        />
      )}
      {detailId && (
        <ReceiptDetailDrawer
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
