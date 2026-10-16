import { Table, Typography } from 'antd'
import { FIELD_LABELS } from '../../constants/audit'
import type { AuditLogEntry } from '../../types/settings'

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non'
  if (Array.isArray(value)) return value.length === 0 ? '—' : value.map(display).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

interface ChangeRow {
  field: string
  before: string
  after: string
}

/** Détail d'une entrée du journal : champ par champ, ce qui a changé (les champs identiques sont masqués). */
export function AuditChanges({ entry }: { entry: AuditLogEntry }) {
  const before = entry.before ?? {}
  const after = entry.after ?? {}
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])]
  const rows: ChangeRow[] = fields
    .map((field) => ({ field, before: display(before[field]), after: display(after[field]) }))
    .filter((row) => !entry.before || !entry.after || row.before !== row.after)

  if (rows.length === 0) {
    return <Typography.Text type="secondary">Aucun détail enregistré.</Typography.Text>
  }

  // Création ou suppression : une seule colonne utile
  const showBefore = entry.before !== null
  const showAfter = entry.after !== null

  return (
    <Table<ChangeRow>
      size="small"
      rowKey="field"
      pagination={false}
      dataSource={rows}
      columns={[
        { title: 'Champ', dataIndex: 'field', width: 200, render: (field: string) => FIELD_LABELS[field] ?? field },
        ...(showBefore ? [{ title: 'Avant', dataIndex: 'before', render: (value: string) => <span className="break-all">{value}</span> }] : []),
        ...(showAfter ? [{ title: showBefore ? 'Après' : 'Valeur', dataIndex: 'after', render: (value: string) => <span className="break-all">{value}</span> }] : []),
      ]}
    />
  )
}
