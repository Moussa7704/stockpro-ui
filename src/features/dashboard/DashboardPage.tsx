import { AppstoreOutlined, DatabaseOutlined, ShoppingCartOutlined, SolutionOutlined } from '@ant-design/icons'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
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
import type { Dashboard, TopProduct } from '../../types/reports'
import { formatDate, formatMoney, formatQuantity } from '../../utils/format'
import { comparisonLabel, periodBounds, periodTitle, type PeriodSelection } from './period'
import { PeriodPicker } from './PeriodPicker'
import { RestockCard } from './RestockCard'
import { useShopFilter } from '../../hook/useActiveShop'

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
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <Typography.Title level={2} className="mb-0">
        Bonjour {user?.name}
      </Typography.Title>
      <Typography.Text type="secondary">
        {activeCompany?.name} · {activeCompany?.role.name}
      </Typography.Text>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

const shortDay = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
const monthYear = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric', timeZone: 'UTC' })
const utc = (day: string) => new Date(`${day}T12:00:00Z`)

/** Tuiles de la vue du jour : aujourd'hui (vs hier) et le mois en cours. */
function TodayTiles({ dashboard }: { dashboard: Dashboard }) {
  return (
    <>
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
    </>
  )
}

/** Tuiles d'une période passée, comparée à la période précédente. */
function PeriodTiles({ dashboard, selection }: { dashboard: Dashboard; selection: PeriodSelection }) {
  const { period } = dashboard
  const { previous } = period
  const deltaLabel = comparisonLabel(selection, previous)
  return (
    <>
      <StatTile
        title="Chiffre d’affaires net"
        value={formatMoney(period.netRevenue)}
        delta={percentChange(period.netRevenue, previous.netRevenue)}
        deltaLabel={deltaLabel}
        hint={`${period.salesCount} vente(s) · panier moyen ${formatMoney(period.averageBasket)}`}
      />
      <StatTile
        title="Marge brute"
        value={formatMoney(period.grossMargin)}
        delta={percentChange(period.grossMargin, previous.grossMargin)}
        deltaLabel={deltaLabel}
        hint={period.marginRate === null ? 'Aucune vente sur la période' : `Taux de marge : ${period.marginRate.replace('.', ',')} %`}
      />
      <StatTile
        title="Résultat (estimé)"
        value={formatMoney(period.netResult)}
        tone={Number(period.netResult) < 0 ? 'danger' : 'default'}
        hint={`Marge − dépenses (${formatMoney(period.expenses)})${Number(period.netResult) < 0 ? ' · déficitaire' : ''}`}
      />
      <StatTile title="Retours" value={formatMoney(period.refunds)} hint={`Remises : ${formatMoney(period.discounts)}`} />
    </>
  )
}

/** Tableau de bord (reports.view) : le jour et le mois en cours, ou une période passée. */
function Overview() {
  const { user, can } = useAuth()
  const shopId = useShopFilter()
  const [selection, setSelection] = useState<PeriodSelection>({ mode: 'today' })
  const bounds = periodBounds(selection)
  const { data: dashboard, error, isPlaceholderData } = useQuery({
    queryKey: queryKeys.reports.dashboard({ shopId, ...bounds }),
    queryFn: async () => (await reportsService.getDashboard({ shopId, ...bounds })).dashboard,
    staleTime: 60_000,
    // Pendant le chargement d'une autre période, on garde l'affichage précédent (atténué)
    placeholderData: keepPreviousData,
  })
  const isToday = selection.mode === 'today'

  const chart =
    dashboard &&
    (isToday
      ? {
          title: 'Chiffre d’affaires net — 7 derniers jours',
          data: dashboard.last7Days.map((day) => ({ label: dayLabel.format(utc(day.date)), value: Number(day.netRevenue), display: formatMoney(day.netRevenue) })),
        }
      : {
          title: `Chiffre d’affaires net — ${dashboard.period.groupBy === 'month' ? 'par mois' : 'par jour'}`,
          data: dashboard.period.chart.map((point) => ({
            label:
              dashboard.period.groupBy === 'month'
                ? monthYear.format(utc(point.period))
                : dashboard.period.days <= 7
                  ? dayLabel.format(utc(point.period))
                  : shortDay.format(utc(point.period)),
            value: Number(point.netRevenue),
            display: formatMoney(point.netRevenue),
          })),
        })

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Typography.Title level={2} className="mb-0">
            Bonjour {user?.name}
          </Typography.Title>
          {dashboard && <Typography.Text type="secondary">{isToday ? `Situation au ${formatDate(dashboard.date)}` : periodTitle(selection)}</Typography.Text>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker value={selection} onChange={setSelection} />
        </div>
      </div>

      {error && <Alert type="error" title={getErrorMessage(error)} showIcon />}
      {!dashboard ? (
        !error && <Skeleton active />
      ) : (
        <div className={`flex flex-col gap-4 transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`} aria-busy={isPlaceholderData}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {isToday ? <TodayTiles dashboard={dashboard} /> : <PeriodTiles dashboard={dashboard} selection={selection} />}
          </div>

          {/* Stock, créances et caisses : toujours la situation actuelle (le stock n'est pas historisé) */}
          {!isToday && (
            <Typography.Text type="secondary" className="-mb-2 text-sm">
              Situation actuelle (stock, créances, caisses)
            </Typography.Text>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
            {isToday && <StatTile title="Retours du jour" value={formatMoney(dashboard.today.refunds)} hint={`Remises du jour : ${formatMoney(dashboard.today.discounts)}`} />}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
            <div className="xl:col-span-3">{chart && <ChartCard title={chart.title} valueLabel="CA net" data={chart.data} />}</div>
            <Card size="small" title={isToday ? 'Meilleurs produits du mois' : 'Meilleurs produits de la période'} className="xl:col-span-2" extra={<Link to="/reports">Tous les rapports</Link>}>
              <Table<TopProduct>
                rowKey="productId"
                size="small"
                pagination={false}
                dataSource={dashboard.topProducts}
                locale={{ emptyText: isToday ? 'Aucune vente ce mois-ci' : 'Aucune vente sur la période' }}
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
        </div>
      )}
    </div>
  )
}

export function DashboardPage() {
  const { user, activeCompany, can } = useAuth()
  if (!user || !activeCompany) return null
  return can('reports.view') ? <Overview /> : <Welcome />
}
