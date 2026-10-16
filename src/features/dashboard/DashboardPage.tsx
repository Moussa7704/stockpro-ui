import { AppstoreOutlined, DatabaseOutlined, ShoppingCartOutlined, SolutionOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Skeleton, Table, Tag, Typography } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChartCard } from '../../components/charts/ChartCard'
import { percentChange } from '../../components/charts/percentChange'
import { StatTile } from '../../components/charts/StatTile'
import { Money } from '../../components/Money'
import { useAuth } from '../../hook/useAuth'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage } from '../../services/api'
import * as reportsService from '../../services/reports.service'
import type { TopProduct } from '../../types/reports'
import { formatDate, formatMoney, formatQuantity } from '../../utils/format'
import { ShopFilter } from '../stock/ShopFilter'
import { RestockCard } from './RestockCard'

const dayLabel = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })

/** Accueil des rôles sans accès aux rapports : raccourcis vers leur travail. */
function Welcome() {
  const { user, activeCompany, can } = useAuth()
  const shortcuts = [
    { to: '/pos', label: 'Ouvrir la caisse', icon: <ShoppingCartOutlined />, allowed: can('sales.create') },
    { to: '/stock', label: 'Voir le stock', icon: <DatabaseOutlined />, allowed: can('stock.view') },
    { to: '/products', label: 'Produits', icon: <AppstoreOutlined />, allowed: can('products.view') },
    { to: '/customers', label: 'Clients', icon: <SolutionOutlined />, allowed: can('customers.manage') },
  ].filter((shortcut) => shortcut.allowed)

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <Typography.Title level={2} className="mb-0">
        Bonjour {user?.name}
      </Typography.Title>
      <Typography.Text type="secondary">
        {activeCompany?.name} · {activeCompany?.role.name}
      </Typography.Text>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {shortcuts.map((shortcut) => (
          <Link key={shortcut.to} to={shortcut.to}>
            <Button block size="large" icon={shortcut.icon}>
              {shortcut.label}
            </Button>
          </Link>
        ))}
      </div>
      {can('stock.view') && <RestockCard />}
    </div>
  )
}

/** Tableau de bord (reports.view) : la journée, le mois, le stock, les créances et les caisses. */
function Overview() {
  const { user, can } = useAuth()
  const [shopId, setShopId] = useState<string | undefined>()
  const { data: dashboard, error } = useQuery({
    queryKey: queryKeys.reports.dashboard(shopId),
    queryFn: async () => (await reportsService.getDashboard(shopId)).dashboard,
    staleTime: 60_000,
  })

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Typography.Title level={2} className="mb-0">
            Bonjour {user?.name}
          </Typography.Title>
          {dashboard && <Typography.Text type="secondary">Situation au {formatDate(dashboard.date)}</Typography.Text>}
        </div>
        <ShopFilter value={shopId} onChange={setShopId} />
      </div>

      {error && <Alert type="error" title={getErrorMessage(error)} showIcon />}
      {!dashboard ? (
        !error && <Skeleton active />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              title="Chiffre d’affaires du jour"
              value={formatMoney(dashboard.today.netRevenue)}
              delta={percentChange(dashboard.today.netRevenue, dashboard.yesterday.netRevenue)}
              hint={`${dashboard.today.salesCount} vente(s) · panier moyen ${formatMoney(dashboard.today.averageBasket)}`}
            />
            <StatTile title="Chiffre d’affaires du mois" value={formatMoney(dashboard.month.netRevenue)} hint={`${dashboard.month.salesCount} vente(s) depuis le ${formatDate(dashboard.month.from)}`} />
            <StatTile
              title="Marge brute du mois"
              value={formatMoney(dashboard.month.grossMargin)}
              hint={dashboard.month.marginRate === null ? 'Aucune vente ce mois-ci' : `Taux de marge : ${dashboard.month.marginRate.replace('.', ',')} %`}
            />
            <StatTile
              title="Résultat du mois (estimé)"
              value={formatMoney(dashboard.month.netResult)}
              tone={Number(dashboard.month.netResult) < 0 ? 'danger' : 'default'}
              hint={`Marge − dépenses (${formatMoney(dashboard.month.expenses)})${Number(dashboard.month.netResult) < 0 ? ' · déficitaire' : ''}`}
            />
            <StatTile
              title="Valeur du stock"
              value={formatMoney(dashboard.stock.value)}
              hint={
                dashboard.stock.lowStockCount + dashboard.stock.outOfStockCount > 0 ? (
                  <Link to="/stock?vue=alertes">
                    {dashboard.stock.lowStockCount} en stock bas · {dashboard.stock.outOfStockCount} en rupture
                  </Link>
                ) : (
                  'Aucune alerte de stock'
                )
              }
            />
            <StatTile
              title="Créances clients"
              value={formatMoney(dashboard.customers.totalDebt)}
              hint={dashboard.customers.debtorsCount > 0 ? <Link to="/debtors">{dashboard.customers.debtorsCount} client(s) débiteur(s)</Link> : 'Aucun impayé'}
            />
            <StatTile title="Caisses ouvertes" value={dashboard.openCashSessions} hint={dashboard.openCashSessions > 0 ? 'Pensez à les clôturer en fin de journée' : 'Aucune caisse ouverte'} />
            <StatTile title="Retours du jour" value={formatMoney(dashboard.today.refunds)} hint={`Remises du jour : ${formatMoney(dashboard.today.discounts)}`} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
            <div className="xl:col-span-3">
              <ChartCard
                title="Chiffre d’affaires net — 7 derniers jours"
                valueLabel="CA net"
                data={dashboard.last7Days.map((day) => ({
                  label: dayLabel.format(new Date(`${day.date}T12:00:00Z`)),
                  value: Number(day.netRevenue),
                  display: formatMoney(day.netRevenue),
                }))}
              />
            </div>
            <Card size="small" title="Meilleurs produits du mois" className="xl:col-span-2" extra={<Link to="/reports">Tous les rapports</Link>}>
              <Table<TopProduct>
                rowKey="productId"
                size="small"
                pagination={false}
                dataSource={dashboard.topProducts}
                locale={{ emptyText: 'Aucune vente ce mois-ci' }}
                columns={[
                  {
                    title: 'Produit',
                    key: 'name',
                    render: (_, product, index) => (
                      <span>
                        <Tag>{index + 1}</Tag>
                        {product.name}
                      </span>
                    ),
                  },
                  { title: 'Qté', key: 'quantity', align: 'right', width: 70, render: (_, product) => formatQuantity(product.quantity) },
                  { title: 'CA net', dataIndex: 'revenue', align: 'right', render: (value: string) => <Money value={value} /> },
                ]}
              />
            </Card>
          </div>

          {can('stock.view') && <RestockCard shopId={shopId} />}
        </>
      )}
    </div>
  )
}

export function DashboardPage() {
  const { user, activeCompany, can } = useAuth()
  if (!user || !activeCompany) return null
  return can('reports.view') ? <Overview /> : <Welcome />
}
