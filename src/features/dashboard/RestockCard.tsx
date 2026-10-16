import { Alert, Card, Table, Tag, Tooltip, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { Link } from 'react-router-dom'
import { getErrorMessage } from '../../services/api'
import type { StockAlert } from '../../types/stock'
import { formatQuantity } from '../../utils/format'
import { useStockAlerts } from '../stock/queries'
import { StockAlertStatusTag } from '../stock/StockAlertStatusTag'

/** Nombre de lignes affichées : le reste est dans la vue des alertes du stock. */
const RESTOCK_LIMIT = 10

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
  { title: 'Boutique', key: 'shop', width: 100, render: (_, alert) => <Tooltip title={alert.shop.name}><Tag>{alert.shop.code}</Tag></Tooltip> },
  {
    title: 'En stock',
    key: 'quantity',
    width: 110,
    align: 'right',
    render: (_, alert) => (
      <span className="font-semibold text-red-600 tabular-nums">
        {formatQuantity(alert.quantity)} {alert.product.unit}
      </span>
    ),
  },
  { title: 'Seuil', dataIndex: 'alertThreshold', width: 80, align: 'right', render: (value: string) => (Number(value) > 0 ? formatQuantity(value) : '—') },
  { title: 'État', key: 'status', width: 110, render: (_, alert) => <StockAlertStatusTag status={alert.status} /> },
]

/**
 * Produits à réapprovisionner (stock.view) : ruptures en tête, puis stock bas — l'ordre vient
 * du serveur. Les 10 plus urgents ; les suivants dans la vue des alertes du stock.
 */
export function RestockCard({ shopId }: { shopId?: string }) {
  const { data: alerts = [], isPending, error } = useStockAlerts(shopId)
  const outOfStock = alerts.filter((alert) => alert.status === 'out_of_stock').length
  const hidden = alerts.length - RESTOCK_LIMIT

  return (
    <Card
      size="small"
      title={
        <span>
          À réapprovisionner
          {alerts.length > 0 && (
            <Typography.Text type="secondary" className="ml-2 text-sm font-normal">
              {outOfStock} en rupture · {alerts.length - outOfStock} en stock bas
            </Typography.Text>
          )}
        </span>
      }
      extra={alerts.length > 0 && <Link to="/stock?vue=alertes">Voir toutes les alertes</Link>}
    >
      {error && <Alert type="error" title={getErrorMessage(error)} showIcon className="mb-3" />}
      <Table<StockAlert>
        rowKey={(alert) => `${alert.shop.id}:${alert.product.id}`}
        size="small"
        pagination={false}
        loading={isPending && !error}
        columns={columns}
        dataSource={alerts.slice(0, RESTOCK_LIMIT)}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'Rien à réapprovisionner : aucun produit en rupture ni sous son seuil' }}
      />
      {hidden > 0 && (
        <Typography.Text type="secondary" className="mt-2 block text-sm">
          Et {hidden} autre(s) produit(s) — <Link to="/stock?vue=alertes">voir toutes les alertes</Link>
        </Typography.Text>
      )}
    </Card>
  )
}
