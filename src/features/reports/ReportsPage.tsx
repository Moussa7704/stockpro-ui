import { FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, App, Button, Card, DatePicker, Segmented, Skeleton, Table, Tabs, Typography } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChartCard } from '../../components/charts/ChartCard'
import { StatTile } from '../../components/charts/StatTile'
import { Money } from '../../components/Money'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage } from '../../services/api'
import * as reportsService from '../../services/reports.service'
import type { ExportFormat, GroupBy, ReportName, SalesFigures, TopProductsReport } from '../../types/reports'
import { formatDate, formatMoney, formatQuantity } from '../../utils/format'
import { ShopFilter } from '../stock/ShopFilter'

interface Filters {
  from: string
  to: string
  shopId?: string
}

const rate = (value: string | null) => (value === null ? '—' : `${value.replace('.', ',')} %`)

const shortDay = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
const monthYear = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric', timeZone: 'UTC' })

/** Libellé court d'une période (axe du graphique, tableau) : "16/10", "sem. du 12/10", "oct. 2026". */
function periodLabel(period: string, groupBy: GroupBy): string {
  const date = new Date(`${period}T12:00:00Z`)
  if (groupBy === 'month') return monthYear.format(date)
  return groupBy === 'week' ? `sem. du ${shortDay.format(date)}` : shortDay.format(date)
}

/** Boutons d'export : même rapport, mêmes filtres, en Excel ou en PDF. */
function ExportButtons({ report, params }: { report: ReportName; params: Record<string, string | number | undefined> }) {
  const { message } = App.useApp()
  const [busy, setBusy] = useState<ExportFormat | null>(null)
  async function download(format: ExportFormat) {
    setBusy(format)
    try {
      await reportsService.downloadReport(report, format, params)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }
  return (
    <div className="flex gap-2">
      <Button icon={<FileExcelOutlined />} loading={busy === 'xlsx'} onClick={() => void download('xlsx')}>
        Excel
      </Button>
      <Button icon={<FilePdfOutlined />} loading={busy === 'pdf'} onClick={() => void download('pdf')}>
        PDF
      </Button>
    </div>
  )
}

const figuresColumns = [
  { title: 'Ventes', dataIndex: 'salesCount', align: 'right' as const },
  { title: 'CA', dataIndex: 'revenue', align: 'right' as const, render: (value: string) => <Money value={value} /> },
  { title: 'Remises', dataIndex: 'discounts', align: 'right' as const, render: (value: string) => <Money value={value} /> },
  { title: 'Retours', dataIndex: 'refunds', align: 'right' as const, render: (value: string) => <Money value={value} /> },
  { title: 'CA net', dataIndex: 'netRevenue', align: 'right' as const, render: (value: string) => <Money value={value} className="font-semibold" /> },
  { title: 'Coût des ventes', dataIndex: 'cost', align: 'right' as const, render: (value: string) => <Money value={value} /> },
  { title: 'Marge brute', dataIndex: 'grossMargin', align: 'right' as const, render: (value: string) => <Money value={value} /> },
  { title: 'Taux', dataIndex: 'marginRate', align: 'right' as const, render: rate },
]

function SalesTab({ filters }: { filters: Filters }) {
  const [groupBy, setGroupBy] = useState<GroupBy>('day')
  const params = { ...filters, groupBy }
  const { data: report, error, isPending } = useQuery({
    queryKey: queryKeys.reports.report('sales', params),
    queryFn: async () => (await reportsService.getSalesReport(params)).report,
  })
  if (error) return <Alert type="error" title={getErrorMessage(error)} showIcon />
  if (isPending || !report) return <Skeleton active />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<GroupBy>
          value={groupBy}
          onChange={setGroupBy}
          options={[
            { value: 'day', label: 'Par jour' },
            { value: 'week', label: 'Par semaine' },
            { value: 'month', label: 'Par mois' },
          ]}
          aria-label="Regroupement"
        />
        <ExportButtons report="sales" params={params} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile title="Chiffre d’affaires net" value={formatMoney(report.totals.netRevenue)} hint={`${report.totals.salesCount} vente(s)`} />
        <StatTile title="Marge brute" value={formatMoney(report.totals.grossMargin)} hint={`Taux : ${rate(report.totals.marginRate)}`} />
        <StatTile title="Panier moyen" value={formatMoney(report.totals.averageBasket)} />
        <StatTile title="Remises et retours" value={formatMoney(Number(report.totals.discounts) + Number(report.totals.refunds))} hint={`Remises ${formatMoney(report.totals.discounts)} · retours ${formatMoney(report.totals.refunds)}`} />
      </div>
      <ChartCard
        title="Chiffre d’affaires net par période"
        valueLabel="CA net"
        data={report.rows.map((row) => ({ label: periodLabel(row.period, report.groupBy), value: Number(row.netRevenue), display: formatMoney(row.netRevenue) }))}
      />
      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table<SalesFigures & { period: string }>
          rowKey="period"
          size="small"
          pagination={false}
          scroll={{ x: 900 }}
          dataSource={report.rows}
          columns={[{ title: 'Période', dataIndex: 'period', render: (value: string) => periodLabel(value, report.groupBy) }, ...figuresColumns]}
          summary={() => (
            <Table.Summary.Row className="font-semibold">
              <Table.Summary.Cell index={0}>Total</Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right">
                {report.totals.salesCount}
              </Table.Summary.Cell>
              {(['revenue', 'discounts', 'refunds', 'netRevenue', 'cost', 'grossMargin'] as const).map((key, index) => (
                <Table.Summary.Cell key={key} index={index + 2} align="right">
                  <Money value={report.totals[key]} />
                </Table.Summary.Cell>
              ))}
              <Table.Summary.Cell index={8} align="right">
                {rate(report.totals.marginRate)}
              </Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </Card>
    </div>
  )
}

function TopProductsTab({ filters }: { filters: Filters }) {
  const [sortBy, setSortBy] = useState<TopProductsReport['sortBy']>('revenue')
  const params = { ...filters, sortBy, limit: 50 }
  const { data: report, error, isPending } = useQuery({
    queryKey: queryKeys.reports.report('top-products', params),
    queryFn: async () => (await reportsService.getTopProducts(params)).report,
  })
  if (error) return <Alert type="error" title={getErrorMessage(error)} showIcon />
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<TopProductsReport['sortBy']>
          value={sortBy}
          onChange={setSortBy}
          options={[
            { value: 'revenue', label: 'Par chiffre d’affaires' },
            { value: 'quantity', label: 'Par quantité' },
            { value: 'margin', label: 'Par marge' },
          ]}
          aria-label="Classement"
        />
        <ExportButtons report="top-products" params={params} />
      </div>
      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="productId"
          size="small"
          loading={isPending}
          pagination={false}
          scroll={{ x: 760 }}
          dataSource={report?.items ?? []}
          locale={{ emptyText: 'Aucune vente sur cette période' }}
          columns={[
            { title: '#', key: 'rank', width: 50, render: (_, __, index) => index + 1 },
            { title: 'Produit', key: 'name', render: (_, item) => <span>{item.name} <Typography.Text type="secondary" className="text-xs">{item.sku}</Typography.Text></span> },
            { title: 'Quantité', key: 'quantity', align: 'right', render: (_, item) => `${formatQuantity(item.quantity)} ${item.unit}` },
            { title: 'CA net', dataIndex: 'revenue', align: 'right', render: (value: string) => <Money value={value} /> },
            { title: 'Coût', dataIndex: 'cost', align: 'right', render: (value: string) => <Money value={value} /> },
            { title: 'Marge', dataIndex: 'grossMargin', align: 'right', render: (value: string) => <Money value={value} /> },
            { title: 'Taux', dataIndex: 'marginRate', align: 'right', render: rate },
          ]}
        />
      </Card>
    </div>
  )
}

function StockValueTab({ shopId }: { shopId?: string }) {
  const { data: report, error, isPending } = useQuery({
    queryKey: queryKeys.reports.report('stock-value', { shopId }),
    queryFn: async () => (await reportsService.getStockValue(shopId)).report,
  })
  if (error) return <Alert type="error" title={getErrorMessage(error)} showIcon />
  if (isPending || !report) return <Skeleton active />
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Typography.Text type="secondary">Au {formatDate(report.date)}, valorisé au coût moyen pondéré</Typography.Text>
        <ExportButtons report="stock-value" params={{ shopId }} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile title="Valeur au coût" value={formatMoney(report.totals.value)} />
        <StatTile title="Valeur au prix de vente" value={formatMoney(report.totals.retailValue)} />
        <StatTile title="Marge potentielle" value={formatMoney(report.totals.potentialMargin)} hint="Si tout le stock était vendu au prix actuel" />
      </div>
      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          rowKey={(item) => `${item.shopId}:${item.productId}`}
          size="small"
          pagination={{ pageSize: 50, hideOnSinglePage: true }}
          scroll={{ x: 760 }}
          dataSource={report.items}
          locale={{ emptyText: 'Aucun stock' }}
          columns={[
            { title: 'Boutique', dataIndex: 'shopName' },
            { title: 'Produit', dataIndex: 'name' },
            { title: 'Quantité', key: 'quantity', align: 'right', render: (_, item) => `${formatQuantity(item.quantity)} ${item.unit}` },
            { title: 'Coût moyen', dataIndex: 'averageCost', align: 'right', render: (value: string) => <Money value={value} /> },
            { title: 'Valeur (coût)', dataIndex: 'value', align: 'right', render: (value: string) => <Money value={value} /> },
            { title: 'Valeur (vente)', dataIndex: 'retailValue', align: 'right', render: (value: string) => <Money value={value} /> },
          ]}
        />
      </Card>
    </div>
  )
}

function ExpensesTab({ filters }: { filters: Filters }) {
  const { data: report, error, isPending } = useQuery({
    queryKey: queryKeys.reports.report('expenses', filters),
    queryFn: async () => (await reportsService.getExpensesReport(filters)).report,
  })
  if (error) return <Alert type="error" title={getErrorMessage(error)} showIcon />
  if (isPending || !report) return <Skeleton active />
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatTile title="Total des dépenses" value={formatMoney(report.total)} />
        <ExportButtons report="expenses" params={{ ...filters }} />
      </div>
      <ChartCard
        title="Dépenses par catégorie"
        orientation="bars"
        valueLabel="Montant"
        emptyText="Aucune dépense sur cette période"
        data={report.byCategory.map((category) => ({ label: category.name, value: Number(category.amount), display: `${formatMoney(category.amount)} (${category.count})` }))}
      />
    </div>
  )
}

function ProfitAndLossTab({ filters }: { filters: Filters }) {
  const { data: report, error, isPending } = useQuery({
    queryKey: queryKeys.reports.report('profit-and-loss', filters),
    queryFn: async () => (await reportsService.getProfitAndLoss(filters)).report,
  })
  if (error) return <Alert type="error" title={getErrorMessage(error)} showIcon />
  if (isPending || !report) return <Skeleton active />
  const negative = Number(report.netResult) < 0
  const rows = [
    { key: 'revenue', label: 'Chiffre d’affaires (ventes validées)', amount: report.sales.revenue },
    { key: 'refunds', label: '− Retours clients', amount: report.sales.refunds },
    { key: 'net', label: '= Chiffre d’affaires net', amount: report.sales.netRevenue, strong: true },
    { key: 'cost', label: '− Coût des ventes', amount: report.sales.cost },
    { key: 'margin', label: `= Marge brute (${rate(report.sales.marginRate)})`, amount: report.sales.grossMargin, strong: true },
    ...report.expenses.byCategory.map((category) => ({ key: category.categoryId, label: `− Dépenses : ${category.name}`, amount: category.amount })),
  ]
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Typography.Text type="secondary">Estimation : coût des ventes au coût moyen pondéré, hors taxes et amortissements.</Typography.Text>
        <ExportButtons report="profit-and-loss" params={{ ...filters }} />
      </div>
      <Card size="small" className="max-w-2xl">
        <Table
          rowKey="key"
          size="small"
          pagination={false}
          showHeader={false}
          dataSource={rows}
          columns={[
            { dataIndex: 'label', render: (value: string, row: { strong?: boolean }) => <span className={row.strong ? 'font-semibold' : ''}>{value}</span> },
            { dataIndex: 'amount', align: 'right', render: (value: string, row: { strong?: boolean }) => <Money value={value} className={row.strong ? 'font-semibold' : ''} /> },
          ]}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0}>
                <span className="font-semibold">= Résultat net estimé {negative && '(déficit)'}</span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right">
                <Money value={report.netResult} className={`text-lg font-bold ${negative ? 'text-red-600' : ''}`} />
              </Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </Card>
    </div>
  )
}

const TABS = ['sales', 'top-products', 'stock-value', 'expenses', 'profit-and-loss'] as const
type Tab = (typeof TABS)[number]

/** Rapports (reports.view) : période et boutique communes à tous les onglets, exports Excel et PDF. */
export function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('rapport') as Tab | null
  const tab: Tab = requested && TABS.includes(requested) ? requested : 'sales'
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
  const [shopId, setShopId] = useState<string | undefined>()
  const filters: Filters = { from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD'), shopId }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <Typography.Title level={2} className="mb-0">
        Rapports
      </Typography.Title>
      <div className="flex flex-wrap items-center gap-3">
        {tab !== 'stock-value' && (
          <DatePicker.RangePicker
            value={range}
            onChange={(value) => value?.[0] && value[1] && setRange([value[0], value[1]])}
            format="DD/MM/YYYY"
            allowClear={false}
            disabledDate={(date) => date.isAfter(dayjs(), 'day')}
            presets={[
              { label: 'Aujourd’hui', value: [dayjs(), dayjs()] },
              { label: '7 derniers jours', value: [dayjs().subtract(6, 'day'), dayjs()] },
              { label: 'Ce mois-ci', value: [dayjs().startOf('month'), dayjs()] },
              { label: 'Mois dernier', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
              { label: 'Cette année', value: [dayjs().startOf('year'), dayjs()] },
            ]}
            aria-label="Période"
          />
        )}
        <ShopFilter value={shopId} onChange={setShopId} />
      </div>
      <Tabs
        activeKey={tab}
        onChange={(key) => setSearchParams({ rapport: key }, { replace: true })}
        destroyOnHidden
        items={[
          { key: 'sales', label: 'Ventes', children: <SalesTab filters={filters} /> },
          { key: 'top-products', label: 'Meilleurs produits', children: <TopProductsTab filters={filters} /> },
          { key: 'stock-value', label: 'Valeur du stock', children: <StockValueTab shopId={shopId} /> },
          { key: 'expenses', label: 'Dépenses', children: <ExpensesTab filters={filters} /> },
          { key: 'profit-and-loss', label: 'Compte de résultat', children: <ProfitAndLossTab filters={filters} /> },
        ]}
      />
    </div>
  )
}
