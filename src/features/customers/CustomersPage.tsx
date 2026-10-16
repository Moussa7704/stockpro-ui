import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Input, Segmented, Switch, Table, Tag, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Money } from '../../components/Money'
import { useDebouncedValue } from '../../hook/useDebouncedValue'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage } from '../../services/api'
import * as customersService from '../../services/customers.service'
import type { Customer } from '../../types/customers'
import { CustomerFormModal } from './CustomerFormModal'

const PAGE_SIZE = 20

/** Clients : recherche (nom, téléphone, email), filtre « avec dette », création. */
export function CustomersPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [withDebt, setWithDebt] = useState(false)
  const [includeArchived, setIncludeArchived] = useState(false)
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const debouncedSearch = useDebouncedValue(search.trim())

  const query = { page, pageSize: PAGE_SIZE, search: debouncedSearch || undefined, withDebt, includeArchived }
  const { data, isFetching, error } = useQuery({
    queryKey: queryKeys.customers.list(query),
    queryFn: () => customersService.listCustomers(query),
    placeholderData: keepPreviousData,
  })

  const columns: TableColumnsType<Customer> = [
    {
      title: 'Client',
      key: 'name',
      render: (_, customer) => (
        <div className="flex flex-col">
          <span>
            <Typography.Text strong>{customer.name}</Typography.Text> {customer.archivedAt && <Tag>Archivé</Tag>}
          </span>
          {customer.email && (
            <Typography.Text type="secondary" className="text-xs">
              {customer.email}
            </Typography.Text>
          )}
        </div>
      ),
    },
    { title: 'Téléphone', dataIndex: 'phone', width: 170, responsive: ['md'], render: (value: string | null) => value ?? '—' },
    {
      title: 'Dette',
      dataIndex: 'balance',
      width: 150,
      align: 'right',
      render: (value: string) => (Number(value) > 0 ? <Money value={value} className="font-semibold text-red-600" /> : '—'),
    },
    {
      title: 'Plafond de crédit',
      dataIndex: 'creditLimit',
      width: 160,
      align: 'right',
      responsive: ['lg'],
      render: (value: string | null) => (value === null ? <Typography.Text type="secondary">Pas de crédit</Typography.Text> : <Money value={value} />),
    },
  ]

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Typography.Title level={2} className="mb-0">
          Clients
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
          Nouveau client
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Nom, téléphone ou email…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          className="max-w-sm"
          aria-label="Rechercher un client"
        />
        <Segmented<boolean>
          value={withDebt}
          onChange={(value) => {
            setWithDebt(value)
            setPage(1)
          }}
          options={[
            { value: false, label: 'Tous' },
            { value: true, label: 'Avec une dette' },
          ]}
          aria-label="Filtre dette"
        />
        <label className="flex items-center gap-2 text-sm">
          <Switch
            size="small"
            checked={includeArchived}
            onChange={(checked) => {
              setIncludeArchived(checked)
              setPage(1)
            }}
            aria-label="Afficher les clients archivés"
          />
          Afficher les archivés
        </label>
      </div>

      {error && <Alert type="error" title={getErrorMessage(error)} showIcon />}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<Customer>
          rowKey="id"
          columns={columns}
          dataSource={data?.items ?? []}
          loading={isFetching}
          scroll={{ x: 560 }}
          onRow={(customer) => ({ onClick: () => navigate(`/customers/${customer.id}`), className: 'cursor-pointer' })}
          pagination={{ current: page, pageSize: PAGE_SIZE, total: data?.total ?? 0, onChange: setPage, showSizeChanger: false, showTotal: (total) => `${total} client(s)` }}
          locale={{ emptyText: debouncedSearch || withDebt ? 'Aucun client ne correspond' : 'Aucun client' }}
        />
      </Card>

      {creating && (
        <CustomerFormModal
          customer={null}
          onCancel={() => setCreating(false)}
          onSaved={(customer) => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.customers.all })
            setCreating(false)
            message.success(`Client « ${customer.name} » créé`)
            navigate(`/customers/${customer.id}`)
          }}
        />
      )}
    </div>
  )
}
