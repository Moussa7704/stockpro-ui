import { HistoryOutlined, SearchOutlined, WarningOutlined } from '@ant-design/icons'
import { Alert, Badge, Button, Card, Input, Segmented, Table, Tag, Tooltip, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Money } from '../../components/Money'
import { useDebouncedValue } from '../../hook/useDebouncedValue'
import { getErrorMessage } from '../../services/api'
import type { StockAlert, StockLevel } from '../../types/stock'
import { formatQuantity } from '../../utils/format'
import { useStockAlerts, useStockLevels } from './queries'
import { ShopFilter } from './ShopFilter'
import { StockAlertStatusTag } from './StockAlertStatusTag'

const PAGE_SIZE = 20

const movementsLink = (productId: string, productName: string) =>
  `/stock/movements?${new URLSearchParams({ productId, produit: productName }).toString()}`

/**
 * Alertes : ruptures en tête (y compris un produit sans seuil déjà stocké), puis les produits au
 * niveau ou sous leur seuil, même jamais reçus dans une boutique.
 */
function AlertsTable({ shopId }: { shopId?: string }) {
  const { data: alerts = [], isPending, error } = useStockAlerts(shopId)
  const columns: TableColumnsType<StockAlert> = [
    {
      title: 'Produit',
      key: 'product',
      render: (_, alert) => (
        <div className="flex flex-col">
          <Typography.Text strong>{alert.product.name}</Typography.Text>
          <Typography.Text type="secondary" className="text-xs">
            {alert.product.sku}
          </Typography.Text>
        </div>
      ),
    },
    { title: 'Boutique', key: 'shop', width: 110, render: (_, alert) => <Tooltip title={alert.shop.name}><Tag>{alert.shop.code}</Tag></Tooltip> },
    {
      title: 'En stock',
      key: 'quantity',
      width: 130,
      align: 'right',
      render: (_, alert) => (
        <span className="font-semibold text-red-600 tabular-nums">
          {formatQuantity(alert.quantity)} {alert.product.unit}
        </span>
      ),
    },
    { title: 'Seuil', dataIndex: 'alertThreshold', width: 100, align: 'right', render: (value: string) => (Number(value) > 0 ? formatQuantity(value) : '—') },
    { title: 'État', key: 'status', width: 120, render: (_, alert) => <StockAlertStatusTag status={alert.status} /> },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_, alert) => (
        <Tooltip title="Mouvements de ce produit">
          <Link to={movementsLink(alert.product.id, alert.product.name)} aria-label={`Mouvements de ${alert.product.name}`}>
            <Button icon={<HistoryOutlined />} size="small" />
          </Link>
        </Tooltip>
      ),
    },
  ]
  return (
    <>
      {error && <Alert type="error" title={getErrorMessage(error)} showIcon className="mb-3" />}
      <Card styles={{ body: { padding: 0 } }}>
        <Table<StockAlert>
          rowKey={(alert) => `${alert.shop.id}:${alert.product.id}`}
          columns={columns}
          dataSource={alerts}
          loading={isPending}
          pagination={{ pageSize: 50, hideOnSinglePage: true }}
          locale={{ emptyText: 'Aucun produit à réapprovisionner' }}
        />
      </Card>
    </>
  )
}

/** Niveaux de stock par produit et par boutique (stock.view) ; valeur au coût moyen si autorisé. */
export function StockLevelsPage() {
  // /stock?vue=alertes ouvre directement les alertes (liens du tableau de bord)
  const [searchParams] = useSearchParams()
  const [view, setView] = useState<'levels' | 'alerts'>(searchParams.get('vue') === 'alertes' ? 'alerts' : 'levels')
  const [shopId, setShopId] = useState<string | undefined>()
  const [search, setSearch] = useState('')
  const [lowStock, setLowStock] = useState(false)
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebouncedValue(search.trim())

  const { data, isFetching, error } = useStockLevels({ page, pageSize: PAGE_SIZE, shopId, search: debouncedSearch || undefined, lowStock })
  const { data: alerts = [] } = useStockAlerts(shopId)
  // Coût moyen et valeur : renvoyés par le serveur seulement à ceux qui voient les coûts
  const withCosts = (data?.items ?? []).some((level) => level.averageCost !== undefined)

  const columns: TableColumnsType<StockLevel> = [
    {
      title: 'Produit',
      key: 'product',
      render: (_, level) => (
        <div className="flex flex-col">
          <Typography.Text strong>{level.product.name}</Typography.Text>
          <Typography.Text type="secondary" className="text-xs">
            {level.product.sku}
            {level.product.barcode && ` · ${level.product.barcode}`}
          </Typography.Text>
        </div>
      ),
    },
    { title: 'Boutique', key: 'shop', width: 110, render: (_, level) => <Tooltip title={level.shop.name}><Tag>{level.shop.code}</Tag></Tooltip> },
    {
      title: 'Quantité',
      key: 'quantity',
      width: 150,
      align: 'right',
      render: (_, level) => (
        <span className={`tabular-nums ${level.lowStock ? 'font-semibold text-red-600' : ''}`}>
          {level.lowStock && <WarningOutlined className="mr-1" />}
          {formatQuantity(level.quantity)} {level.product.unit}
        </span>
      ),
    },
    {
      title: 'Seuil',
      dataIndex: 'alertThreshold',
      width: 100,
      align: 'right',
      responsive: ['md'],
      render: (value: string) => (Number(value) > 0 ? formatQuantity(value) : '—'),
    },
    ...(withCosts
      ? [
          { title: 'Coût moyen', key: 'averageCost', width: 140, align: 'right' as const, responsive: ['lg' as const], render: (_: unknown, level: StockLevel) => <Money value={level.averageCost} /> },
          { title: 'Valeur', key: 'stockValue', width: 150, align: 'right' as const, render: (_: unknown, level: StockLevel) => <Money value={level.stockValue} /> },
        ]
      : []),
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_, level) => (
        <Tooltip title="Mouvements de ce produit">
          <Link to={movementsLink(level.product.id, level.product.name)} aria-label={`Mouvements de ${level.product.name}`}>
            <Button icon={<HistoryOutlined />} size="small" />
          </Link>
        </Tooltip>
      ),
    },
  ]

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <Typography.Title level={2} className="mb-0">
        Niveaux de stock
      </Typography.Title>

      <div className="flex flex-wrap items-center gap-3">
        <Segmented<'levels' | 'alerts'>
          value={view}
          onChange={setView}
          options={[
            { value: 'levels', label: 'Niveaux' },
            {
              value: 'alerts',
              label: (
                <span className="inline-flex items-center gap-2">
                  Alertes <Badge count={alerts.length} size="small" />
                </span>
              ),
            },
          ]}
          aria-label="Affichage"
        />
        <ShopFilter
          value={shopId}
          onChange={(value) => {
            setShopId(value)
            setPage(1)
          }}
        />
        {view === 'levels' && (
          <>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Nom, référence ou code-barres…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              className="max-w-xs"
              aria-label="Rechercher un produit"
            />
            <Segmented<boolean>
              value={lowStock}
              onChange={(value) => {
                setLowStock(value)
                setPage(1)
              }}
              options={[
                { value: false, label: 'Tous' },
                { value: true, label: 'Stock bas' },
              ]}
              aria-label="Filtre stock bas"
            />
          </>
        )}
      </div>

      {view === 'alerts' ? (
        <AlertsTable shopId={shopId} />
      ) : (
        <>
          {error && <Alert type="error" title={getErrorMessage(error)} showIcon />}
          <Card styles={{ body: { padding: 0 } }}>
            <Table<StockLevel>
              rowKey={(level) => `${level.shop.id}:${level.product.id}`}
              columns={columns}
              dataSource={data?.items ?? []}
              loading={isFetching}
              scroll={{ x: 720 }}
              pagination={{ current: page, pageSize: PAGE_SIZE, total: data?.total ?? 0, onChange: setPage, showSizeChanger: false, showTotal: (total) => `${total} ligne(s)` }}
              locale={{ emptyText: debouncedSearch || lowStock ? 'Aucun produit ne correspond' : 'Aucun stock : commencez par un ajustement « Stock initial »' }}
            />
          </Card>
        </>
      )}
    </div>
  )
}
