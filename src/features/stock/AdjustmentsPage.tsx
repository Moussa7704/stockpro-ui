import { PlusOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Descriptions, Drawer, Skeleton, Table, Tag, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { useState } from 'react'
import { ADJUSTMENT_REASON_LABELS } from '../../constants/stock'
import { usePermission } from '../../hook/usePermission'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage } from '../../services/api'
import * as stockService from '../../services/stock.service'
import type { StockAdjustment } from '../../types/stock'
import { formatDateTime, formatQuantity } from '../../utils/format'
import { AdjustmentFormDrawer } from './AdjustmentFormDrawer'
import { useAdjustments, useShopName } from './queries'
import { useShopFilter } from '../../hook/useActiveShop'
import { usePage } from '../../hook/usePage'

const PAGE_SIZE = 20

function AdjustmentDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const shopName = useShopName()
  const { data: adjustment, error } = useQuery({
    queryKey: queryKeys.stock.adjustment(id),
    queryFn: async () => (await stockService.getAdjustment(id)).adjustment,
  })

  return (
    <Drawer open title={adjustment ? `Ajustement ${adjustment.number}` : 'Ajustement'} size={640} onClose={onClose}>
      {error && <Alert type="error" title={getErrorMessage(error)} showIcon />}
      {!adjustment ? (
        !error && <Skeleton active />
      ) : (
        <div className="flex flex-col gap-4">
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Date">{formatDateTime(adjustment.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="Boutique">{shopName(adjustment.shopId)}</Descriptions.Item>
            <Descriptions.Item label="Motif">{ADJUSTMENT_REASON_LABELS[adjustment.reason]}</Descriptions.Item>
            {adjustment.notes && <Descriptions.Item label="Commentaire">{adjustment.notes}</Descriptions.Item>}
          </Descriptions>
          <Table
            rowKey={(line) => line.product.id}
            size="small"
            pagination={false}
            dataSource={adjustment.lines ?? []}
            columns={[
              { title: 'Produit', key: 'product', render: (_, line) => line.product.name },
              {
                title: 'Quantité',
                dataIndex: 'quantity',
                align: 'right',
                render: (value: string) => (
                  <span className={value.startsWith('-') ? 'text-red-600' : 'text-green-700'}>
                    {value.startsWith('-') ? `−${formatQuantity(value.slice(1))}` : `+${formatQuantity(value)}`}
                  </span>
                ),
              },
              { title: 'Stock après', dataIndex: 'balanceAfter', align: 'right', render: (value: string) => formatQuantity(value) },
            ]}
          />
        </div>
      )}
    </Drawer>
  )
}

/** Ajustements de stock (stock initial, casse, perte…) : pièces justificatives numérotées. */
export function AdjustmentsPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const canAdjust = usePermission('stock.adjust')
  const shopName = useShopName()
  const shopId = useShopFilter()
  const [page, setPage] = usePage(shopId)
  const [creating, setCreating] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const { data, isFetching, error } = useAdjustments({ page, pageSize: PAGE_SIZE, shopId })

  const columns: TableColumnsType<StockAdjustment> = [
    { title: 'Numéro', dataIndex: 'number', render: (value: string) => <Typography.Text strong>{value}</Typography.Text> },
    { title: 'Date', dataIndex: 'createdAt', width: 150, render: (value: string) => formatDateTime(value) },
    { title: 'Boutique', key: 'shop', width: 180, responsive: ['md'], render: (_, adjustment) => shopName(adjustment.shopId) },
    { title: 'Motif', dataIndex: 'reason', width: 170, render: (value: StockAdjustment['reason']) => <Tag>{ADJUSTMENT_REASON_LABELS[value]}</Tag> },
    {
      title: '',
      key: 'actions',
      width: 90,
      render: (_, adjustment) => (
        <Button size="small" onClick={() => setDetailId(adjustment.id)} aria-label={`Voir ${adjustment.number}`}>
          Détail
        </Button>
      ),
    },
  ]

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Typography.Title level={2} className="mb-0">
          Ajustements de stock
        </Typography.Title>
        {canAdjust && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
            Nouvel ajustement
          </Button>
        )}
      </div>

      {error && <Alert type="error" title={getErrorMessage(error)} showIcon />}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<StockAdjustment>
          rowKey="id"
          columns={columns}
          dataSource={data?.items ?? []}
          loading={isFetching}
          scroll={{ x: 600 }}
          pagination={{ current: page, pageSize: PAGE_SIZE, total: data?.total ?? 0, onChange: setPage, showSizeChanger: false, hideOnSinglePage: true }}
          locale={{ emptyText: 'Aucun ajustement' }}
        />
      </Card>

      {creating && (
        <AdjustmentFormDrawer
          onClose={() => setCreating(false)}
          onSaved={(adjustment) => {
            // Niveaux, alertes, journal et liste des ajustements changent
            void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
            setCreating(false)
            message.success(`Ajustement ${adjustment.number} enregistré`)
          }}
        />
      )}
      {detailId && <AdjustmentDetail id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  )
}
