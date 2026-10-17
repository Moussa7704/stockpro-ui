import { ReloadOutlined } from '@ant-design/icons'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Select, Table, Tag, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { useState } from 'react'
import { ACTION_LABELS, ENTITY_LABELS, auditActionLabel, entityLabel } from '../../constants/audit'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage } from '../../services/api'
import * as auditService from '../../services/audit.service'
import type { AuditLogEntry } from '../../types/settings'
import { formatDateTime } from '../../utils/format'
import { AuditChanges } from './AuditChanges'

const PAGE_SIZE = 20

const sortedOptions = (labels: Record<string, string>) =>
  Object.entries(labels)
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'))

/** Couleur selon la nature de l'action : suppressions et annulations en rouge, créations en vert. */
function actionColor(action: string): string {
  if (/(cancel|delete|disable|suspend|archive|difference|discrepancy)/.test(action)) return 'red'
  if (/(create|invite|open|restore|reactivate)/.test(action)) return 'green'
  return 'blue'
}

/** Journal d'audit (permission audit.view) : qui a fait quoi, quand, avec l'avant / après. */
export function AuditLogPage() {
  const [page, setPage] = useState(1)
  const [entityType, setEntityType] = useState<string | undefined>()
  const [action, setAction] = useState<string | undefined>()

  const query = { page, pageSize: PAGE_SIZE, entityType, action }
  const { data, error, isFetching, refetch } = useQuery({
    queryKey: queryKeys.auditLogs(query),
    queryFn: () => auditService.listAuditLogs(query),
    // Pendant le chargement de la page suivante, on garde l'ancienne affichée
    placeholderData: keepPreviousData,
    staleTime: 0,
  })

  const columns: TableColumnsType<AuditLogEntry> = [
    {
      title: 'Date',
      dataIndex: 'createdAt',
      width: 150,
      render: (value: string) => <span className="whitespace-nowrap tabular-nums">{formatDateTime(value)}</span>,
    },
    {
      title: 'Auteur',
      key: 'actor',
      width: 200,
      render: (_, entry) =>
        entry.actor ? (
          <div className="flex flex-col">
            <Typography.Text>{entry.actor.name ?? 'Compte supprimé'}</Typography.Text>
            <Typography.Text type="secondary" className="text-xs">
              {entry.actor.email}
            </Typography.Text>
          </div>
        ) : (
          <Typography.Text type="secondary">Système</Typography.Text>
        ),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      render: (value: string) => <Tag color={actionColor(value)}>{auditActionLabel(value)}</Tag>,
    },
    { title: 'Élément', dataIndex: 'entityType', width: 180, responsive: ['md'], render: (value: string | null) => entityLabel(value) },
  ]

  function changeFilter(update: () => void) {
    update()
    setPage(1)
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Typography.Title level={2} className="mb-0">
          Journal d’audit
        </Typography.Title>
        <Button icon={<ReloadOutlined />} onClick={() => void refetch()} loading={isFetching}>
          Actualiser
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select
          allowClear
          showSearch={{ optionFilterProp: 'label' }}
          placeholder="Tous les éléments"
          value={entityType}
          onChange={(value) => changeFilter(() => setEntityType(value))}
          options={sortedOptions(ENTITY_LABELS)}
          className="w-56"
          aria-label="Filtrer par élément"
        />
        <Select
          allowClear
          showSearch={{ optionFilterProp: 'label' }}
          placeholder="Toutes les actions"
          value={action}
          onChange={(value) => changeFilter(() => setAction(value))}
          options={sortedOptions(ACTION_LABELS)}
          className="w-72"
          aria-label="Filtrer par action"
        />
      </div>

      {error && <Alert type="error" title={getErrorMessage(error)} showIcon />}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<AuditLogEntry>
          rowKey="id"
          columns={columns}
          dataSource={data?.items ?? []}
          loading={isFetching}
          scroll={{ x: 700 }}
          expandable={{
            expandedRowRender: (entry) => <AuditChanges entry={entry} />,
            rowExpandable: (entry) => entry.before !== null || entry.after !== null,
          }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: data?.total ?? 0,
            showSizeChanger: false,
            showTotal: (total) => `${total} entrée(s)`,
            onChange: setPage,
          }}
          locale={{ emptyText: 'Aucune action enregistrée pour ces filtres' }}
        />
      </Card>
    </div>
  )
}
