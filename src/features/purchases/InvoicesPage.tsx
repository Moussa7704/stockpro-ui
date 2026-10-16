import { PlusOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Segmented, Select, Table, Tag, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { useState } from 'react'
import { Money } from '../../components/Money'
import { INVOICE_STATUS } from '../../constants/purchases'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage } from '../../services/api'
import type { InvoiceStatus, SupplierBalance, SupplierInvoice } from '../../types/purchases'
import { formatDate } from '../../utils/format'
import { InvoiceDetailDrawer, InvoiceFormModal } from './InvoiceDrawers'
import { useInvoices, useSupplierBalances } from './queries'
import { SupplierSelect } from './SupplierSelect'

const PAGE_SIZE = 20

/** Ce que l'on doit à chaque fournisseur (factures ouvertes), échu compris. */
function BalancesTable() {
  const { data: balances = [], isPending, error } = useSupplierBalances()
  const columns: TableColumnsType<SupplierBalance> = [
    { title: 'Fournisseur', key: 'supplier', render: (_, balance) => <Typography.Text strong>{balance.supplier.name}</Typography.Text> },
    { title: 'Factures ouvertes', dataIndex: 'openInvoices', width: 150, align: 'right' },
    { title: 'Facturé', dataIndex: 'invoiced', width: 150, align: 'right', responsive: ['md'], render: (value: string) => <Money value={value} /> },
    { title: 'Payé', dataIndex: 'paid', width: 150, align: 'right', responsive: ['md'], render: (value: string) => <Money value={value} /> },
    { title: 'Reste dû', dataIndex: 'outstanding', width: 160, align: 'right', render: (value: string) => <Money value={value} className="font-semibold" /> },
    {
      title: 'Dont échu',
      dataIndex: 'overdue',
      width: 150,
      align: 'right',
      render: (value: string) => (Number(value) > 0 ? <Money value={value} className="font-semibold text-red-600" /> : '—'),
    },
  ]
  const total = balances.reduce((sum, balance) => sum + Number(balance.outstanding), 0)

  return (
    <>
      {error && <Alert type="error" title={getErrorMessage(error)} showIcon className="mb-3" />}
      <Card styles={{ body: { padding: 0 } }}>
        <Table<SupplierBalance>
          rowKey={(balance) => balance.supplier.id}
          columns={columns}
          dataSource={balances.filter((balance) => Number(balance.outstanding) > 0)}
          loading={isPending}
          pagination={false}
          scroll={{ x: 640 }}
          locale={{ emptyText: 'Aucune dette fournisseur' }}
          summary={() =>
            total > 0 && (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={4}>
                  <Typography.Text strong>Total dû aux fournisseurs</Typography.Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <Money value={total} className="font-semibold" />
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} />
              </Table.Summary.Row>
            )
          }
        />
      </Card>
    </>
  )
}

/** Factures fournisseurs et paiements (supplier_payments.manage), et dettes par fournisseur. */
export function InvoicesPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [view, setView] = useState<'invoices' | 'balances'>('invoices')
  const [status, setStatus] = useState<InvoiceStatus | undefined>()
  const [supplierId, setSupplierId] = useState<string | undefined>()
  const [overdue, setOverdue] = useState(false)
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const { data, isFetching, error } = useInvoices({ page, pageSize: PAGE_SIZE, status, supplierId, overdue })

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all })
  const filter = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value)
    setPage(1)
  }

  const columns: TableColumnsType<SupplierInvoice> = [
    { title: 'N° de facture', dataIndex: 'reference', render: (value: string) => <Typography.Text strong>{value}</Typography.Text> },
    { title: 'Fournisseur', key: 'supplier', render: (_, invoice) => invoice.supplier?.name },
    { title: 'Date', dataIndex: 'invoiceDate', width: 120, responsive: ['md'], render: (value: string) => formatDate(value) },
    {
      title: 'Échéance',
      dataIndex: 'dueDate',
      width: 130,
      render: (value: string | null, invoice) => (value ? <span className={invoice.overdue ? 'font-semibold text-red-600' : ''}>{formatDate(value)}</span> : '—'),
    },
    { title: 'Montant', dataIndex: 'total', width: 140, align: 'right', responsive: ['lg'], render: (value: string) => <Money value={value} /> },
    { title: 'Reste dû', dataIndex: 'remaining', width: 140, align: 'right', render: (value: string) => <Money value={value} /> },
    {
      title: 'État',
      key: 'status',
      width: 170,
      render: (_, invoice) => (
        <>
          <Tag color={INVOICE_STATUS[invoice.status].color}>{INVOICE_STATUS[invoice.status].label}</Tag>
          {invoice.overdue && <Tag color="red">Échue</Tag>}
        </>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      render: (_, invoice) => (
        <Button size="small" onClick={() => setDetailId(invoice.id)} aria-label={`Ouvrir la facture ${invoice.reference}`}>
          Ouvrir
        </Button>
      ),
    },
  ]

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Typography.Title level={2} className="mb-0">
          Factures fournisseurs
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
          Nouvelle facture
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Segmented<'invoices' | 'balances'>
          value={view}
          onChange={setView}
          options={[
            { value: 'invoices', label: 'Factures' },
            { value: 'balances', label: 'Dettes fournisseurs' },
          ]}
          aria-label="Affichage"
        />
        {view === 'invoices' && (
          <>
            <SupplierSelect allowClear value={supplierId} onChange={filter(setSupplierId)} placeholder="Tous les fournisseurs" className="w-60" />
            <Select
              allowClear
              value={status}
              onChange={(value) => filter(setStatus)(value ?? undefined)}
              placeholder="Tous les états"
              options={Object.entries(INVOICE_STATUS).map(([value, { label }]) => ({ value, label }))}
              className="w-44"
              aria-label="Filtrer par état"
            />
            <Segmented<boolean>
              value={overdue}
              onChange={filter(setOverdue)}
              options={[
                { value: false, label: 'Toutes' },
                { value: true, label: 'Échues' },
              ]}
              aria-label="Filtre échéance"
            />
          </>
        )}
      </div>

      {view === 'balances' ? (
        <BalancesTable />
      ) : (
        <>
          {error && <Alert type="error" title={getErrorMessage(error)} showIcon />}
          <Card styles={{ body: { padding: 0 } }}>
            <Table<SupplierInvoice>
              rowKey="id"
              columns={columns}
              dataSource={data?.items ?? []}
              loading={isFetching}
              scroll={{ x: 760 }}
              pagination={{ current: page, pageSize: PAGE_SIZE, total: data?.total ?? 0, onChange: setPage, showSizeChanger: false, hideOnSinglePage: true }}
              locale={{ emptyText: overdue ? 'Aucune facture échue' : 'Aucune facture' }}
            />
          </Card>
        </>
      )}

      {creating && (
        <InvoiceFormModal
          onCancel={() => setCreating(false)}
          onSaved={(invoice) => {
            void refresh()
            setCreating(false)
            setDetailId(invoice.id)
            message.success(`Facture ${invoice.reference} enregistrée`)
          }}
        />
      )}
      {detailId && (
        <InvoiceDetailDrawer
          key={detailId}
          id={detailId}
          onClose={() => setDetailId(null)}
          onChanged={(text) => {
            void refresh()
            message.success(text)
          }}
        />
      )}
    </div>
  )
}
