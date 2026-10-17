import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Input, Segmented, Table, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage } from '../../services/api'
import * as platformService from '../../services/platform.service'
import type { CompanyStatus, PlatformCompanySummary } from '../../types/platform'
import { formatDate } from '../../utils/format'
import { CompanyStatusTag } from './CompanyStatusTag'
import { CreateCompanyModal } from './CreateCompanyModal'

type StatusFilter = 'all' | CompanyStatus

/** Accents et casse ignorés : « Épicerie » se trouve en tapant « epicerie ». */
const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Commerçants abonnés (administrateur SaaS) : recherche et filtre dans la page, peu nombreux. */
export function PlatformCompaniesPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [creating, setCreating] = useState(false)
  const { data: companies = [], isPending, error } = useQuery({
    queryKey: queryKeys.platform.companies,
    queryFn: async () => (await platformService.listCompanies()).companies,
  })

  const term = normalize(search.trim())
  const visible = companies.filter((company) => (status === 'all' || company.status === status) && (!term || normalize(`${company.name} ${company.slug}`).includes(term)))
  const suspended = companies.filter((company) => company.status === 'suspended').length

  const columns: TableColumnsType<PlatformCompanySummary> = [
    {
      title: 'Commerçant',
      key: 'name',
      render: (_, company) => (
        <div className="flex flex-col">
          <Link to={`/platform/companies/${company.id}`} className="font-semibold">
            {company.name}
          </Link>
          <Typography.Text type="secondary" className="text-xs">
            {company.slug}
          </Typography.Text>
        </div>
      ),
    },
    { title: 'Statut', key: 'status', width: 130, render: (_, company) => <CompanyStatusTag status={company.status} /> },
    { title: 'Membres actifs', dataIndex: 'activeMembers', width: 140, align: 'right' },
    { title: 'Fuseau', dataIndex: 'timezone', width: 180, render: (zone: string) => zone.replaceAll('_', ' ') },
    { title: 'Créé le', dataIndex: 'createdAt', width: 130, render: (value: string) => formatDate(value) },
  ]

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Typography.Title level={2} className="mb-0">
            Commerçants
          </Typography.Title>
          {!isPending && (
            <Typography.Text type="secondary">
              {companies.length} commerçant(s){suspended > 0 && ` · ${suspended} suspendu(s)`}
            </Typography.Text>
          )}
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
          Nouveau commerçant
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input allowClear prefix={<SearchOutlined />} placeholder="Nom ou identifiant…" value={search} onChange={(event) => setSearch(event.target.value)} className="max-w-sm" aria-label="Rechercher un commerçant" />
        <Segmented<StatusFilter>
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'Tous' },
            { value: 'active', label: 'Actifs' },
            { value: 'suspended', label: 'Suspendus' },
          ]}
          aria-label="Filtrer par statut"
        />
      </div>

      {error && <Alert type="error" title={getErrorMessage(error)} showIcon />}
      <Card styles={{ body: { padding: 0 } }}>
        <Table<PlatformCompanySummary>
          rowKey="id"
          columns={columns}
          dataSource={visible}
          loading={isPending}
          pagination={{ pageSize: 20, hideOnSinglePage: true }}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: companies.length === 0 ? 'Aucun commerçant pour l’instant' : 'Aucun commerçant ne correspond' }}
        />
      </Card>

      {creating && <CreateCompanyModal onClose={() => setCreating(false)} />}
    </div>
  )
}
