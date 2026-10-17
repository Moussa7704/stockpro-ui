import { CheckCircleOutlined, HistoryOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Drawer, Table, Tag, Tooltip, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { Link } from 'react-router-dom'
import { Money } from '../../components/Money'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage } from '../../services/api'
import * as stockService from '../../services/stock.service'
import type { Product } from '../../types/catalog'
import type { ProductShopStock, StockAlertStatus } from '../../types/stock'
import { formatQuantity } from '../../utils/format'
import { movementsLink } from './links'
import { StockAlertStatusTag } from './StockAlertStatusTag'

/** Même règle que les alertes du serveur : rupture à 0, stock bas au niveau ou sous le seuil. */
function levelStatus(quantity: string, threshold: string): StockAlertStatus | null {
  if (Number(quantity) <= 0) return 'out_of_stock'
  return Number(threshold) > 0 && Number(quantity) <= Number(threshold) ? 'low_stock' : null
}

/**
 * Stock d'un produit dans chaque boutique visible (stock.view), avec son état et, pour ceux qui
 * voient les coûts, le coût moyen et la valeur. À monter seulement ouvert.
 */
export function ProductStockDrawer({ product, onClose }: { product: Product; onClose: () => void }) {
  const { data, isPending, error } = useQuery({
    queryKey: queryKeys.stock.product(product.id),
    queryFn: () => stockService.getProductStock(product.id),
  })
  const rows = data?.stock ?? []
  const withCosts = rows.some((row) => row.averageCost !== undefined)
  const total = rows.reduce((sum, row) => sum + Number(row.quantity), 0)
  const totalValue = rows.reduce((sum, row) => sum + Number(row.quantity) * Number(row.averageCost ?? 0), 0)
  const unit = product.unit.symbol

  const columns: TableColumnsType<ProductShopStock> = [
    {
      title: 'Boutique',
      key: 'shop',
      render: (_, row) => (
        <Tooltip title={row.shop.name}>
          <span>
            <Tag>{row.shop.code}</Tag>
            {row.shop.name}
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'En stock',
      key: 'quantity',
      align: 'right',
      render: (_, row) => (
        <span className={`tabular-nums ${levelStatus(row.quantity, product.alertThreshold) ? 'font-semibold text-red-600' : ''}`}>
          {formatQuantity(row.quantity)} {unit}
        </span>
      ),
    },
    {
      title: 'État',
      key: 'status',
      render: (_, row) => {
        const status = levelStatus(row.quantity, product.alertThreshold)
        return status ? (
          <StockAlertStatusTag status={status} />
        ) : (
          <Tag color="success" icon={<CheckCircleOutlined />}>
            Disponible
          </Tag>
        )
      },
    },
    ...(withCosts
      ? [
          { title: 'Coût moyen', key: 'averageCost', align: 'right' as const, render: (_: unknown, row: ProductShopStock) => <Money value={row.averageCost} /> },
          { title: 'Valeur', key: 'value', align: 'right' as const, render: (_: unknown, row: ProductShopStock) => <Money value={Number(row.quantity) * Number(row.averageCost ?? 0)} /> },
        ]
      : []),
  ]

  return (
    <Drawer open title={`Stock par boutique — ${product.name}`} size="large" onClose={onClose} destroyOnHidden>
      <div className="flex flex-col gap-3">
        <Typography.Text type="secondary">
          {product.sku}
          {Number(product.alertThreshold) > 0 ? ` · seuil d’alerte : ${formatQuantity(product.alertThreshold)} ${unit}` : ' · sans seuil d’alerte'}
        </Typography.Text>
        {error && <Alert type="error" title={getErrorMessage(error)} showIcon />}
        <Table<ProductShopStock>
          rowKey={(row) => row.shop.id}
          size="small"
          pagination={false}
          loading={isPending}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'Aucune boutique visible' }}
          summary={() =>
            rows.length > 1 && (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0}>
                  <Typography.Text strong>Total</Typography.Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <Typography.Text strong className="tabular-nums">
                    {formatQuantity(total)} {unit}
                  </Typography.Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} />
                {withCosts && (
                  <>
                    <Table.Summary.Cell index={3} />
                    <Table.Summary.Cell index={4} align="right">
                      <Typography.Text strong>
                        <Money value={totalValue} />
                      </Typography.Text>
                    </Table.Summary.Cell>
                  </>
                )}
              </Table.Summary.Row>
            )
          }
        />
        <Link to={movementsLink(product.id, product.name)} className="inline-flex items-center gap-1">
          <HistoryOutlined /> Voir les mouvements de ce produit
        </Link>
      </div>
    </Drawer>
  )
}
