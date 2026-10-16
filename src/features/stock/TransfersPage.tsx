import { ArrowRightOutlined, PlusOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Select, Table, Tag, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { useState } from 'react'
import { TRANSFER_STATUS } from '../../constants/stock'
import { useShops } from '../../hook/useActiveShop'
import { usePermission } from '../../hook/usePermission'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage } from '../../services/api'
import type { StockTransfer, TransferStatus } from '../../types/stock'
import { formatDateTime } from '../../utils/format'
import { useShopName, useTransfers } from './queries'
import { ShopFilter } from './ShopFilter'
import { TransferDetailDrawer, TransferFormDrawer } from './TransferDrawers'

const PAGE_SIZE = 20

/** Transferts entre boutiques : préparation → expédition (sortie) → réception (entrée, écarts tracés). */
export function TransfersPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const canTransfer = usePermission('stock.transfer')
  const { data: shops = [] } = useShops()
  const shopName = useShopName()
  const [shopId, setShopId] = useState<string | undefined>()
  const [status, setStatus] = useState<TransferStatus | undefined>()
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const { data, isFetching, error } = useTransfers({ page, pageSize: PAGE_SIZE, shopId, status })

  const refreshStock = () => queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })

  const columns: TableColumnsType<StockTransfer> = [
    { title: 'Numéro', dataIndex: 'number', render: (value: string) => <Typography.Text strong>{value}</Typography.Text> },
    { title: 'Date', dataIndex: 'createdAt', width: 150, responsive: ['md'], render: (value: string) => formatDateTime(value) },
    {
      title: 'Trajet',
      key: 'route',
      render: (_, transfer) => (
        <span>
          {shopName(transfer.fromShopId)} <ArrowRightOutlined className="mx-1 text-slate-400" /> {shopName(transfer.toShopId)}
        </span>
      ),
    },
    {
      title: 'État',
      dataIndex: 'status',
      width: 150,
      render: (value: TransferStatus) => <Tag color={TRANSFER_STATUS[value].color}>{TRANSFER_STATUS[value].label}</Tag>,
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      render: (_, transfer) => (
        <Button size="small" onClick={() => setDetailId(transfer.id)} aria-label={`Ouvrir ${transfer.number}`}>
          Ouvrir
        </Button>
      ),
    },
  ]

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Typography.Title level={2} className="mb-0">
          Transferts
        </Typography.Title>
        {canTransfer && shops.length > 1 && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
            Nouveau transfert
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ShopFilter
          value={shopId}
          onChange={(value) => {
            setShopId(value)
            setPage(1)
          }}
        />
        <Select
          allowClear
          value={status}
          onChange={(value) => {
            setStatus(value ?? undefined)
            setPage(1)
          }}
          placeholder="Tous les états"
          options={Object.entries(TRANSFER_STATUS).map(([value, { label }]) => ({ value, label }))}
          className="w-48"
          aria-label="Filtrer par état"
        />
      </div>

      {shops.length < 2 && (
        <Alert type="info" showIcon title="Une seule boutique accessible" description="Les transferts déplacent du stock entre deux boutiques : créez-en une seconde dans Paramètres." />
      )}
      {error && <Alert type="error" title={getErrorMessage(error)} showIcon />}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<StockTransfer>
          rowKey="id"
          columns={columns}
          dataSource={data?.items ?? []}
          loading={isFetching}
          scroll={{ x: 600 }}
          pagination={{ current: page, pageSize: PAGE_SIZE, total: data?.total ?? 0, onChange: setPage, showSizeChanger: false, hideOnSinglePage: true }}
          locale={{ emptyText: 'Aucun transfert' }}
        />
      </Card>

      {creating && (
        <TransferFormDrawer
          onClose={() => setCreating(false)}
          onSaved={(transfer) => {
            void refreshStock()
            setCreating(false)
            setDetailId(transfer.id)
            message.success(`Transfert ${transfer.number} préparé : expédiez-le quand la marchandise part`)
          }}
        />
      )}
      {detailId && (
        <TransferDetailDrawer
          key={detailId}
          id={detailId}
          onClose={() => setDetailId(null)}
          onChanged={(text) => {
            void refreshStock()
            message.success(text)
          }}
        />
      )}
    </div>
  )
}
