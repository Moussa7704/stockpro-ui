import { ArrowLeftOutlined, EditOutlined, PrinterOutlined, WalletOutlined } from '@ant-design/icons'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, DatePicker, Descriptions, Skeleton, Statistic, Table, Tabs, Tag, Typography } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Money } from '../../components/Money'
import { LEDGER_LABELS } from '../../constants/customers'
import { usePermission } from '../../hook/usePermission'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage } from '../../services/api'
import * as customersService from '../../services/customers.service'
import type { CustomerDetail, CustomerPayment, LedgerEntry, LedgerType, StatementEntry } from '../../types/customers'
import { formatDate, formatDateTime, formatMoney } from '../../utils/format'
import { printTable } from '../../utils/print'
import { CustomerFormModal } from './CustomerFormModal'
import { CustomerPaymentModal } from './CustomerPaymentModal'
import { PaymentReceiptModal } from './PaymentReceiptModal'

const PAGE_SIZE = 20

/** Montant signé : + dette en rouge, − (règlement, avoir) en vert. */
function SignedAmount({ value }: { value: string }) {
  const negative = value.startsWith('-')
  return <Money value={negative ? value.slice(1) : value} className={negative ? 'text-green-700' : 'text-red-600'} />
}

function LedgerTab({ customerId }: { customerId: string }) {
  const [page, setPage] = useState(1)
  const query = { page, pageSize: PAGE_SIZE }
  const { data, isFetching, error } = useQuery({
    queryKey: queryKeys.customers.ledger(customerId, query),
    queryFn: () => customersService.listLedger(customerId, query),
    placeholderData: keepPreviousData,
  })
  return (
    <>
      {error && <Alert type="error" title={getErrorMessage(error)} showIcon className="mb-3" />}
      <Table<LedgerEntry>
        rowKey="id"
        size="small"
        dataSource={data?.items ?? []}
        loading={isFetching}
        pagination={{ current: page, pageSize: PAGE_SIZE, total: data?.total ?? 0, onChange: setPage, showSizeChanger: false, hideOnSinglePage: true }}
        locale={{ emptyText: 'Aucune écriture : ce client n’a jamais acheté à crédit' }}
        columns={[
          { title: 'Date', dataIndex: 'createdAt', render: (value: string) => formatDateTime(value) },
          { title: 'Opération', dataIndex: 'type', render: (value: LedgerType) => <Tag>{LEDGER_LABELS[value] ?? value}</Tag> },
          { title: 'Montant', dataIndex: 'amount', align: 'right', render: (value: string) => <SignedAmount value={value} /> },
          { title: 'Solde après', dataIndex: 'balanceAfter', align: 'right', render: (value: string) => <Money value={value} /> },
        ]}
      />
    </>
  )
}

/** Relevé sur une période : solde d'ouverture, mouvements, solde de clôture ; imprimable. */
function StatementTab({ customer }: { customer: CustomerDetail }) {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
  const from = range[0].format('YYYY-MM-DD')
  const to = range[1].format('YYYY-MM-DD')
  const { data: statement, isFetching, error } = useQuery({
    queryKey: queryKeys.customers.statement(customer.id, from, to),
    queryFn: async () => (await customersService.getStatement(customer.id, from, to)).statement,
  })

  function print() {
    if (!statement) return
    printTable({
      title: `Relevé de compte — ${statement.customer.name}`,
      subtitle: [`Du ${formatDate(from)} au ${formatDate(to)}`, ...(statement.customer.phone ? [`Téléphone : ${statement.customer.phone}`] : [])],
      headers: ['Date', 'Opération', 'Référence', 'Débit', 'Crédit', 'Solde'],
      alignRight: [3, 4, 5],
      rows: [
        ['', 'Solde au début de la période', '', '', '', formatMoney(statement.openingBalance)],
        ...statement.entries.map((entry) => [
          formatDateTime(entry.date),
          LEDGER_LABELS[entry.type] ?? entry.type,
          entry.reference ?? '',
          Number(entry.debit) > 0 ? formatMoney(entry.debit) : '',
          Number(entry.credit) > 0 ? formatMoney(entry.credit) : '',
          formatMoney(entry.balance),
        ]),
      ],
      footer: [['', 'Totaux et solde de fin de période', '', formatMoney(statement.totalDebits), formatMoney(statement.totalCredits), formatMoney(statement.closingBalance)]],
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <DatePicker.RangePicker
          value={range}
          onChange={(value) => value?.[0] && value[1] && setRange([value[0], value[1]])}
          format="DD/MM/YYYY"
          allowClear={false}
          aria-label="Période du relevé"
        />
        <Button icon={<PrinterOutlined />} disabled={!statement} onClick={print}>
          Imprimer le relevé
        </Button>
      </div>
      {error && <Alert type="error" title={getErrorMessage(error)} showIcon />}
      {statement && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Statistic title="Solde d’ouverture" value={formatMoney(statement.openingBalance)} />
          <Statistic title="Achats à crédit" value={formatMoney(statement.totalDebits)} />
          <Statistic title="Règlements et avoirs" value={formatMoney(statement.totalCredits)} />
          <Statistic title="Solde de clôture" value={formatMoney(statement.closingBalance)} />
        </div>
      )}
      <Table<StatementEntry>
        rowKey="id"
        size="small"
        pagination={false}
        loading={isFetching}
        dataSource={statement?.entries ?? []}
        locale={{ emptyText: 'Aucun mouvement sur cette période' }}
        columns={[
          { title: 'Date', dataIndex: 'date', render: (value: string) => formatDateTime(value) },
          { title: 'Opération', dataIndex: 'type', render: (value: LedgerType) => LEDGER_LABELS[value] ?? value },
          { title: 'Référence', dataIndex: 'reference', render: (value: string | null) => value ?? '—' },
          { title: 'Débit', dataIndex: 'debit', align: 'right', render: (value: string) => (Number(value) > 0 ? <Money value={value} /> : '') },
          { title: 'Crédit', dataIndex: 'credit', align: 'right', render: (value: string) => (Number(value) > 0 ? <Money value={value} /> : '') },
          { title: 'Solde', dataIndex: 'balance', align: 'right', render: (value: string) => <Money value={value} /> },
        ]}
      />
    </div>
  )
}

function PaymentsTab({ customerId, onReceipt }: { customerId: string; onReceipt: (paymentId: string) => void }) {
  const [page, setPage] = useState(1)
  const query = { page, pageSize: PAGE_SIZE }
  const { data, isFetching } = useQuery({
    queryKey: queryKeys.customers.payments(customerId, query),
    queryFn: () => customersService.listCustomerPayments(customerId, query),
    placeholderData: keepPreviousData,
  })
  return (
    <Table<CustomerPayment>
      rowKey="id"
      size="small"
      dataSource={data?.items ?? []}
      loading={isFetching}
      pagination={{ current: page, pageSize: PAGE_SIZE, total: data?.total ?? 0, onChange: setPage, showSizeChanger: false, hideOnSinglePage: true }}
      locale={{ emptyText: 'Aucun règlement' }}
      columns={[
        { title: 'Date', dataIndex: 'createdAt', render: (value: string) => formatDateTime(value) },
        { title: 'Moyen', key: 'method', render: (_, payment) => payment.paymentMethod?.name ?? '—' },
        { title: 'Référence', dataIndex: 'reference', render: (value: string | null) => value ?? '—' },
        { title: 'Montant', dataIndex: 'amount', align: 'right', render: (value: string) => <Money value={value} /> },
        {
          title: '',
          key: 'receipt',
          width: 90,
          render: (_, payment) => (
            <Button size="small" icon={<PrinterOutlined />} onClick={() => onReceipt(payment.id)} aria-label={`Reçu du règlement du ${formatDateTime(payment.createdAt)}`}>
              Reçu
            </Button>
          ),
        },
      ]}
    />
  )
}

/** Fiche client : dette, crédit disponible, compte, relevé, achats et règlements. */
export function CustomerPage() {
  const { id = '' } = useParams()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const canCollect = usePermission('customer_payments.manage')
  const [editing, setEditing] = useState(false)
  const [paying, setPaying] = useState(false)
  // Reçu affiché : juste après un encaissement, ou réimprimé depuis l'onglet Règlements
  const [receipt, setReceipt] = useState<{ paymentId: string; justPaid: boolean } | null>(null)
  const { data: customer, error } = useQuery({
    queryKey: queryKeys.customers.detail(id),
    queryFn: async () => (await customersService.getCustomer(id)).customer,
  })

  if (error) return <Alert type="error" title={getErrorMessage(error)} showIcon />
  if (!customer) return <Skeleton active />

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.customers.all })
  const inDebt = Number(customer.balance) > 0

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/customers">
            <Button icon={<ArrowLeftOutlined />} aria-label="Retour aux clients" />
          </Link>
          <Typography.Title level={2} className="mb-0">
            {customer.name}
          </Typography.Title>
          {customer.archivedAt && <Tag>Archivé</Tag>}
        </div>
        <div className="flex gap-2">
          <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>
            Modifier
          </Button>
          {canCollect && inDebt && (
            <Button type="primary" icon={<WalletOutlined />} onClick={() => setPaying(true)}>
              Encaisser un règlement
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <Statistic title="Dette actuelle" value={formatMoney(customer.balance)} styles={{ content: { color: inDebt ? '#dc2626' : undefined } }} />
        </Card>
        <Card>
          <Statistic title="Plafond de crédit" value={customer.creditLimit === null ? 'Pas de crédit' : formatMoney(customer.creditLimit)} />
        </Card>
        <Card>
          <Statistic title="Crédit disponible" value={formatMoney(customer.availableCredit)} />
        </Card>
      </div>

      <Card>
        <Descriptions size="small" column={{ xs: 1, md: 3 }}>
          <Descriptions.Item label="Téléphone">{customer.phone ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Email">{customer.email ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Adresse">{customer.address ?? '—'}</Descriptions.Item>
          {customer.notes && <Descriptions.Item label="Notes">{customer.notes}</Descriptions.Item>}
        </Descriptions>
      </Card>

      <Card>
        <Tabs
          destroyOnHidden
          items={[
            { key: 'ledger', label: 'Compte', children: <LedgerTab customerId={customer.id} /> },
            { key: 'statement', label: 'Relevé', children: <StatementTab customer={customer} /> },
            {
              key: 'sales',
              label: 'Achats récents',
              children: (
                <Table
                  rowKey="id"
                  size="small"
                  pagination={false}
                  dataSource={customer.recentSales}
                  locale={{ emptyText: 'Aucun achat' }}
                  columns={[
                    { title: 'Ticket', dataIndex: 'number' },
                    { title: 'Date', dataIndex: 'createdAt', render: (value: string) => formatDateTime(value) },
                    { title: 'Total', dataIndex: 'total', align: 'right', render: (value: string) => <Money value={value} /> },
                    { title: 'À crédit', dataIndex: 'balanceDue', align: 'right', render: (value: string) => (Number(value) > 0 ? <Money value={value} /> : '—') },
                    { title: 'État', dataIndex: 'status', render: (value: string) => (value === 'cancelled' ? <Tag color="red">Annulée</Tag> : <Tag color="green">Validée</Tag>) },
                  ]}
                />
              ),
            },
            { key: 'payments', label: 'Règlements', children: <PaymentsTab customerId={customer.id} onReceipt={(paymentId) => setReceipt({ paymentId, justPaid: false })} /> },
          ]}
        />
      </Card>

      {editing && (
        <CustomerFormModal
          customer={customer}
          onCancel={() => setEditing(false)}
          onSaved={(saved) => {
            void refresh()
            setEditing(false)
            message.success(`${saved.name} mis à jour`)
          }}
        />
      )}
      {paying && (
        <CustomerPaymentModal
          customer={customer}
          onCancel={() => setPaying(false)}
          onPaid={(payment) => {
            void refresh()
            void queryClient.invalidateQueries({ queryKey: queryKeys.pos.all })
            setPaying(false)
            message.success(`Règlement encaissé : nouvelle dette ${formatMoney(payment.customerBalance ?? '0')}`)
            // Le client repart avec son reçu
            setReceipt({ paymentId: payment.id, justPaid: true })
          }}
        />
      )}
      {receipt && <PaymentReceiptModal paymentId={receipt.paymentId} customerName={customer.name} justPaid={receipt.justPaid} onClose={() => setReceipt(null)} />}
    </div>
  )
}
