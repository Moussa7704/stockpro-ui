import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { Alert, App, Button, Card, Popconfirm, Space, Table, Tag, Tooltip, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { getErrorMessage } from '../../services/api'
import * as rolesService from '../../services/roles.service'
import type { PermissionGroup, Role } from '../../types/access'
import { RoleFormModal } from './RoleFormModal'

/**
 * Rôles de l'entreprise (permission roles.manage) : rôles de base modifiables
 * (sauf propriétaire) et rôles personnalisés. `editable` est calculé par le serveur.
 */
export function RolesPage() {
  const { message } = App.useApp()

  const [roles, setRoles] = useState<Role[]>([])
  const [groups, setGroups] = useState<PermissionGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // undefined : modal fermée ; null : création ; Role : modification
  const [formRole, setFormRole] = useState<Role | null | undefined>(undefined)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback((isCancelled: () => boolean = () => false) => {
    return Promise.all([rolesService.listRoles(), rolesService.getPermissionCatalog()])
      .then(([{ roles: list }, { groups: catalog }]) => {
        if (!isCancelled()) {
          setRoles(list)
          setGroups(catalog)
          setError(null)
        }
      })
      .catch((err: unknown) => !isCancelled() && setError(getErrorMessage(err)))
      .finally(() => !isCancelled() && setLoading(false))
  }, [])

  // Premier chargement (loading vaut déjà true au départ)
  useEffect(() => {
    let cancelled = false
    void load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  function reload() {
    setLoading(true)
    void load()
  }

  function handleSaved(saved: Role, created: boolean) {
    setRoles((list) => (created ? [...list, saved] : list.map((item) => (item.id === saved.id ? saved : item))))
    setFormRole(undefined)
    message.success(created ? `Rôle « ${saved.name} » créé` : `Rôle « ${saved.name} » mis à jour`)
  }

  async function handleDelete(target: Role) {
    setDeletingId(target.id)
    try {
      await rolesService.deleteRole(target.id)
      setRoles((list) => list.filter((item) => item.id !== target.id))
      message.success(`Rôle « ${target.name} » supprimé`)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setDeletingId(null)
    }
  }

  // Libellés lisibles des permissions (catalogue du serveur)
  const labels = new Map(groups.flatMap((group) => group.permissions.map((p) => [p.code, p.label] as const)))

  const columns: TableColumnsType<Role> = [
    {
      title: 'Rôle',
      key: 'name',
      render: (_, record) => (
        <div className="flex flex-col">
          <Space size={6}>
            <Typography.Text strong>{record.name}</Typography.Text>
            {record.isSystem && <Tag>de base</Tag>}
          </Space>
          {record.description && (
            <Typography.Text type="secondary" className="text-xs">
              {record.description}
            </Typography.Text>
          )}
        </div>
      ),
    },
    {
      title: 'Permissions',
      key: 'permissions',
      width: 140,
      render: (_, record) =>
        record.code === 'owner' ? (
          <Tag color="gold">Toutes</Tag>
        ) : (
          <Tooltip
            title={
              <ul className="m-0 pl-4">
                {record.permissions.map((permission) => (
                  <li key={permission}>{labels.get(permission) ?? permission}</li>
                ))}
              </ul>
            }
          >
            <Tag color="blue">{record.permissions.length} permission(s)</Tag>
          </Tooltip>
        ),
    },
    {
      title: 'Membres',
      dataIndex: 'memberCount',
      width: 100,
      align: 'right',
    },
    {
      title: '',
      key: 'actions',
      width: 110,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title={record.editable ? 'Modifier' : 'Ce rôle n’est pas modifiable par vous'}>
            <Button
              icon={<EditOutlined />}
              size="small"
              disabled={!record.editable}
              onClick={() => setFormRole(record)}
              aria-label={`Modifier ${record.name}`}
            />
          </Tooltip>
          {!record.isSystem && (
            <Popconfirm
              title={`Supprimer le rôle « ${record.name} » ?`}
              description={record.memberCount > 0 ? 'Changez d’abord le rôle de ses membres.' : undefined}
              okText="Supprimer"
              okButtonProps={{ danger: true }}
              cancelText="Annuler"
              disabled={!record.editable || record.memberCount > 0}
              onConfirm={() => handleDelete(record)}
            >
              <Tooltip title={record.memberCount > 0 ? 'Rôle attribué à des membres' : 'Supprimer'}>
                <Button
                  icon={<DeleteOutlined />}
                  size="small"
                  danger
                  disabled={!record.editable || record.memberCount > 0}
                  loading={deletingId === record.id}
                  aria-label={`Supprimer ${record.name}`}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Typography.Title level={2} className="mb-0">
          Rôles
        </Typography.Title>
        <div className="flex gap-2">
          <Button icon={<ReloadOutlined />} onClick={reload} loading={loading}>
            Actualiser
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setFormRole(null)}>
            Nouveau rôle
          </Button>
        </div>
      </div>

      {error && <Alert type="error" title={error} showIcon />}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<Role>
          rowKey="id"
          columns={columns}
          dataSource={roles}
          loading={loading}
          pagination={false}
          scroll={{ x: 600 }}
        />
      </Card>

      <RoleFormModal
        key={formRole?.id ?? 'new'}
        open={formRole !== undefined}
        role={formRole ?? null}
        groups={groups}
        onCancel={() => setFormRole(undefined)}
        onSaved={handleSaved}
      />
    </div>
  )
}
