import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Modal, Segmented, Table, Tag, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { useState } from 'react'
import { Money } from '../../components/Money'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage } from '../../services/api'
import * as posService from '../../services/pos.service'
import type { CashSession, Sale } from '../../types/pos'
import { formatDateTime } from '../../utils/format'
import { useShopName } from '../stock/queries'
import { ShopFilter } from '../stock/ShopFilter'
import { SaleDetailDrawer } from './SaleDrawers'
import { useSession } from './queries'
import { TicketModal } from './TicketModal'

const PAGE_SIZE = 20

function SessionsTable({ shopId, onOpen }: { shopId?: string; onOpen: (id: string) => void }) {
  const shopName = useShopName()
  const [page, setPage] = useState(1)
  const query = { page, pageSize: PAGE_SIZE, shopId }
  const { data, isFetching, error } = useQuery({ queryKey: queryKeys.pos.sessions(query), queryFn: () => posService.listSessions(query), placeholderData: keepPreviousData })
  const columns: TableColumnsType<CashSession> = [
    { title: 'Ouverte le', dataIndex: 'openedAt', render: (value: string) => formatDateTime(value) },
    { title: 'Boutique', key: 'shop', responsive: ['md'], render: (_, session) => shopName(session.shopId) },
    { title: 'Fond', dataIndex: 'openingFloat', align: 'right', render: (value: string) => <Money value={value} /> },
    { title: 'Attendu', dataIndex: 'expectedCash', align: 'right', responsive: ['lg'], render: (value: string | null) => (value ? <Money value={value} /> : '—') },
    { title: 'Compté', dataIndex: 'countedCash', align: 'right', responsive: ['lg'], render: (value: string | null) => (value ? <Money value={value} /> : '—') },
    {
      title: 'Écart',
      dataIndex: 'difference',
      align: 'right',
      render: (value: string | null) => (value === null ? '—' : <Money value={value} className={Number(value) === 0 ? '' : 'font-semibold'} />),
    },
    { title: 'État', dataIndex: 'status', render: (value: string) => (value === 'open' ? <Tag color="green">Ouverte</Tag> : <Tag>Clôturée</Tag>) },
    { title: '', key: 'open', width: 90, render: (_, session) => <Button size="small" onClick={() => onOpen(session.id)}>Détail</Button> },
  ]
  return (
    <>
      {error && <Alert type="error" title={getErrorMessage(error)} showIcon className="mb-3" />}
      <Card styles={{ body: { padding: 0 } }}>
        <Table<CashSession>
          rowKey="id"
          columns={columns}
          dataSource={data?.items ?? []}
          loading={isFetching}
          scroll={{ x: 700 }}
          pagination={{ current: page, pageSize: PAGE_SIZE, total: data?.total ?? 0, onChange: setPage, showSizeChanger: false, hideOnSinglePage: true }}
          locale={{ emptyText: 'Aucune session de caisse' }}
        />
      </Card>
    </>
  )
}

function SessionSummaryModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: session } = useSession(id)
  const summary = session?.summary
  return (
    <Modal open title="Session de caisse" onCancel={onClose} footer={<Button onClick={onClose}>Fermer</Button>}>
      {summary && (
        <div className="flex flex-col gap-1">
          <Row label="Ventes" value={`${summary.salesCount} vente(s)`} />
          <Row label="Chiffre d’affaires" money={summary.salesTotal} />
          {summary.byMethod.map((method) => (
            <Row key={method.methodId} label={`dont ${method.name}`} money={method.amount} />
          ))}
          <Row label="Fond de caisse" money={session.openingFloat} />
          <Row label="Remboursements en espèces" money={summary.cashRefunds} />
          <Row label="Dépenses payées du tiroir" money={summary.cashExpenses} />
          <Row label="Espèces attendues" money={summary.expectedCash} strong />
          {session.countedCash !== null && <Row label="Espèces comptées" money={session.countedCash} />}
          {session.difference !== null && <Row label="Écart" money={session.difference} strong />}
        </div>
      )}
    </Modal>
  )
}

function Row({ label, value, money, strong }: { label: string; value?: string; money?: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? 'font-semibold' : ''}`}>
      <span>{label}</span>
      {money !== undefined ? <Money value={money} /> : <span>{value}</span>}
    </div>
  )
}

/** Historique de la caisse : ventes (détail, ticket, annulation, retour) et sessions. Un caissier ne voit que les siennes. */
export function SalesPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [view, setView] = useState<'sales' | 'sessions'>('sales')
  const [shopId, setShopId] = useState<string | undefined>()
  const [status, setStatus] = useState<'all' | 'completed' | 'cancelled'>('all')
  const [page, setPage] = useState(1)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [ticketId, setTicketId] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  const query = { page, pageSize: PAGE_SIZE, shopId, status: status === 'all' ? undefined : status }
  const { data, isFetching, error } = useQuery({ queryKey: queryKeys.pos.sales(query), queryFn: () => posService.listSales(query), placeholderData: keepPreviousData })

  const columns: TableColumnsType<Sale> = [
    { title: 'Ticket', dataIndex: 'number', render: (value: string) => <Typography.Text strong>{value}</Typography.Text> },
    { title: 'Date', dataIndex: 'createdAt', width: 150, render: (value: string) => formatDateTime(value) },
    { title: 'Client', key: 'customer', responsive: ['md'], render: (_, sale) => sale.customer?.name ?? '—' },
    { title: 'Total', dataIndex: 'total', width: 140, align: 'right', render: (value: string) => <Money value={value} /> },
    {
      title: 'État',
      key: 'status',
      width: 150,
      render: (_, sale) => (
        <>
          {sale.status === 'cancelled' ? <Tag color="red">Annulée</Tag> : <Tag color="green">Validée</Tag>}
          {Number(sale.balanceDue) > 0 && sale.status === 'completed' && <Tag color="orange">Crédit</Tag>}
        </>
      ),
    },
    { title: '', key: 'open', width: 90, render: (_, sale) => <Button size="small" onClick={() => setDetailId(sale.id)} aria-label={`Ouvrir ${sale.number}`}>Ouvrir</Button> },
  ]

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <Typography.Title level={2} className="mb-0">
        Historique de caisse
      </Typography.Title>
      <div className="flex flex-wrap items-center gap-3">
        <Segmented<'sales' | 'sessions'>
          value={view}
          onChange={setView}
          options={[
            { value: 'sales', label: 'Ventes' },
            { value: 'sessions', label: 'Sessions de caisse' },
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
        {view === 'sales' && (
          <Segmented<'all' | 'completed' | 'cancelled'>
            value={status}
            onChange={(value) => {
              setStatus(value)
              setPage(1)
            }}
            options={[
              { value: 'all', label: 'Toutes' },
              { value: 'completed', label: 'Validées' },
              { value: 'cancelled', label: 'Annulées' },
            ]}
            aria-label="État des ventes"
          />
        )}
      </div>

      {view === 'sessions' ? (
        <SessionsTable shopId={shopId} onOpen={setSessionId} />
      ) : (
        <>
          {error && <Alert type="error" title={getErrorMessage(error)} showIcon />}
          <Card styles={{ body: { padding: 0 } }}>
            <Table<Sale>
              rowKey="id"
              columns={columns}
              dataSource={data?.items ?? []}
              loading={isFetching}
              scroll={{ x: 640 }}
              pagination={{ current: page, pageSize: PAGE_SIZE, total: data?.total ?? 0, onChange: setPage, showSizeChanger: false, showTotal: (total) => `${total} vente(s)` }}
              locale={{ emptyText: 'Aucune vente' }}
            />
          </Card>
        </>
      )}

      {detailId && (
        <SaleDetailDrawer
          key={detailId}
          id={detailId}
          onClose={() => setDetailId(null)}
          onShowTicket={setTicketId}
          onChanged={(text) => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.pos.all })
            void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
            message.success(text)
          }}
        />
      )}
      {ticketId && <TicketModal saleId={ticketId} onClose={() => setTicketId(null)} />}
      {sessionId && <SessionSummaryModal id={sessionId} onClose={() => setSessionId(null)} />}
    </div>
  )
}
