import { Alert, Card, Select, Table, Tag, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Money } from '../../components/Money'
import { MOVEMENT_LABELS } from '../../constants/stock'
import { getErrorMessage } from '../../services/api'
import { MOVEMENT_TYPES, type MovementType, type StockMovement } from '../../types/stock'
import { formatDateTime, formatQuantity } from '../../utils/format'
import { useMovements, useShopName } from './queries'
import { ShopFilter } from './ShopFilter'

const PAGE_SIZE = 25

/** Journal des mouvements de stock (entrées et sorties, en ajout seul), du plus récent au plus ancien. */
export function MovementsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  // Ouvert depuis un produit : ?productId=…&produit=Nom
  const productId = searchParams.get('productId') ?? undefined
  const productName = searchParams.get('produit')
  const [shopId, setShopId] = useState<string | undefined>()
  const [type, setType] = useState<MovementType | undefined>()
  const [page, setPage] = useState(1)
  const shopName = useShopName()

  const { data, isFetching, error } = useMovements({ page, pageSize: PAGE_SIZE, shopId, productId, type })
  const withCosts = (data?.items ?? []).some((movement) => movement.unitCost !== undefined)

  const columns: TableColumnsType<StockMovement> = [
    { title: 'Date', dataIndex: 'createdAt', width: 140, render: (value: string) => <span className="whitespace-nowrap tabular-nums">{formatDateTime(value)}</span> },
    {
      title: 'Produit',
      key: 'product',
      render: (_, movement) => (
        <div className="flex flex-col">
          <Typography.Text>{movement.product.name}</Typography.Text>
          <Typography.Text type="secondary" className="text-xs">
            {movement.product.sku}
          </Typography.Text>
        </div>
      ),
    },
    { title: 'Boutique', key: 'shop', width: 160, responsive: ['md'], render: (_, movement) => shopName(movement.shopId) },
    { title: 'Opération', dataIndex: 'type', width: 180, render: (value: MovementType) => <Tag>{MOVEMENT_LABELS[value] ?? value}</Tag> },
    {
      title: 'Quantité',
      dataIndex: 'quantity',
      width: 110,
      align: 'right',
      render: (value: string) => {
        const exit = value.startsWith('-')
        return (
          <span className={`font-semibold tabular-nums ${exit ? 'text-red-600' : 'text-green-700'}`}>
            {exit ? '−' : '+'}
            {formatQuantity(exit ? value.slice(1) : value)}
          </span>
        )
      },
    },
    { title: 'Stock après', dataIndex: 'balanceAfter', width: 110, align: 'right', responsive: ['md'], render: (value: string) => formatQuantity(value) },
    ...(withCosts
      ? [{ title: 'Coût unitaire', dataIndex: 'unitCost', width: 140, align: 'right' as const, responsive: ['lg' as const], render: (value: string) => <Money value={value} /> }]
      : []),
  ]

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <Typography.Title level={2} className="mb-0">
        Mouvements de stock
      </Typography.Title>

      <div className="flex flex-wrap items-center gap-3">
        {productId && (
          <Tag
            closable
            color="blue"
            onClose={() => {
              setSearchParams({})
              setPage(1)
            }}
            className="px-2 py-1"
          >
            Produit : {productName ?? 'sélectionné'}
          </Tag>
        )}
        <ShopFilter
          value={shopId}
          onChange={(value) => {
            setShopId(value)
            setPage(1)
          }}
        />
        <Select
          allowClear
          value={type}
          onChange={(value) => {
            setType(value ?? undefined)
            setPage(1)
          }}
          placeholder="Toutes les opérations"
          options={MOVEMENT_TYPES.map((value) => ({ value, label: MOVEMENT_LABELS[value] }))}
          className="w-56"
          aria-label="Filtrer par opération"
        />
      </div>

      {error && <Alert type="error" title={getErrorMessage(error)} showIcon />}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<StockMovement>
          rowKey="id"
          columns={columns}
          dataSource={data?.items ?? []}
          loading={isFetching}
          scroll={{ x: 760 }}
          pagination={{ current: page, pageSize: PAGE_SIZE, total: data?.total ?? 0, onChange: setPage, showSizeChanger: false, showTotal: (total) => `${total} mouvement(s)` }}
          locale={{ emptyText: 'Aucun mouvement' }}
        />
      </Card>
    </div>
  )
}
