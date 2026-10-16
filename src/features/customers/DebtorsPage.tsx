import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Alert, Card, Statistic, Table, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Money } from '../../components/Money'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage } from '../../services/api'
import * as customersService from '../../services/customers.service'
import type { Debtor } from '../../types/customers'
import { formatDate, formatMoney } from '../../utils/format'

const PAGE_SIZE = 20

const agingCell = (value: string, danger = false) =>
  Number(value) > 0 ? <Money value={value} className={danger ? 'font-semibold text-red-600' : ''} /> : <Typography.Text type="secondary">—</Typography.Text>

/**
 * Impayés : clients débiteurs et ancienneté de leur dette. Les règlements soldent d'abord les
 * dettes les plus anciennes : ce qui reste correspond aux achats les plus récents.
 */
export function DebtorsPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const query = { page, pageSize: PAGE_SIZE }
  const { data, isFetching, error } = useQuery({
    queryKey: queryKeys.customers.debtors(query),
    queryFn: () => customersService.listDebtors(query),
    placeholderData: keepPreviousData,
  })

  const columns: TableColumnsType<Debtor> = [
    {
      title: 'Client',
      key: 'name',
      render: (_, debtor) => (
        <div className="flex flex-col">
          <Typography.Text strong>{debtor.name}</Typography.Text>
          {debtor.phone && (
            <Typography.Text type="secondary" className="text-xs">
              {debtor.phone}
            </Typography.Text>
          )}
        </div>
      ),
    },
    { title: 'Dette totale', dataIndex: 'balance', align: 'right', render: (value: string) => <Money value={value} className="font-semibold" /> },
    { title: '0 – 30 j', key: 'current', align: 'right', responsive: ['md'], render: (_, debtor) => agingCell(debtor.aging.current) },
    { title: '31 – 60 j', key: 'd60', align: 'right', responsive: ['md'], render: (_, debtor) => agingCell(debtor.aging.days31To60) },
    { title: '61 – 90 j', key: 'd90', align: 'right', responsive: ['lg'], render: (_, debtor) => agingCell(debtor.aging.days61To90, true) },
    { title: '+ 90 j', key: 'over90', align: 'right', render: (_, debtor) => agingCell(debtor.aging.over90, true) },
    { title: 'Plus ancienne', dataIndex: 'oldestUnpaidAt', responsive: ['lg'], render: (value: string | null) => (value ? formatDate(value) : '—') },
  ]

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <Typography.Title level={2} className="mb-0">
        Impayés
      </Typography.Title>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <Statistic title="Total dû par les clients" value={formatMoney(data?.totalDebt ?? '0')} />
        </Card>
        <Card>
          <Statistic title="Clients débiteurs" value={data?.total ?? 0} />
        </Card>
      </div>

      {error && <Alert type="error" title={getErrorMessage(error)} showIcon />}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<Debtor>
          rowKey="id"
          columns={columns}
          dataSource={data?.items ?? []}
          loading={isFetching}
          scroll={{ x: 720 }}
          onRow={(debtor) => ({ onClick: () => navigate(`/customers/${debtor.id}`), className: 'cursor-pointer' })}
          pagination={{ current: page, pageSize: PAGE_SIZE, total: data?.total ?? 0, onChange: setPage, showSizeChanger: false, hideOnSinglePage: true }}
          locale={{ emptyText: 'Aucun impayé : tous les clients sont à jour' }}
        />
      </Card>
    </div>
  )
}
