import { EditOutlined, MailOutlined, ReloadOutlined, SafetyOutlined, UserAddOutlined } from '@ant-design/icons'
import { Alert, App, Button, Card, Space, Table, Tag, Tooltip, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { getErrorMessage } from '../../services/api'
import * as membersService from '../../services/members.service'
import * as rolesService from '../../services/roles.service'
import * as shopsService from '../../services/shops.service'
import type { Member, PermissionGroup, Role, ShopSummary } from '../../types/access'
import { MemberFormModal } from './MemberFormModal'
import { MemberPermissionsDrawer } from './MemberPermissionsDrawer'

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' })

interface PageData {
  members: Member[]
  roles: Role[]
  shops: ShopSummary[]
  groups: PermissionGroup[]
}

function fetchPageData(): Promise<PageData> {
  return Promise.all([
    membersService.listMembers(),
    rolesService.listRoles(),
    shopsService.listShops(),
    rolesService.getPermissionCatalog(),
  ]).then(([{ members }, { roles }, { shops }, { groups }]) => ({ members, roles, shops, groups }))
}

/**
 * Équipe de l'entreprise (permission users.manage) : invitation, rôle, boutiques, statut
 * et ajustement des droits. `editable` (calculé par le serveur) dit qui on peut modifier.
 */
export function MembersPage() {
  const { message } = App.useApp()

  const [data, setData] = useState<PageData>({ members: [], roles: [], shops: [], groups: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // undefined : modal fermée ; null : invitation ; Member : modification
  const [formMember, setFormMember] = useState<Member | null | undefined>(undefined)
  const [permissionsMember, setPermissionsMember] = useState<Member | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Applique le résultat d'un chargement (sauf si la page a été quittée entre-temps)
  const load = useCallback((isCancelled: () => boolean = () => false) => {
    return fetchPageData()
      .then((result) => {
        if (!isCancelled()) {
          setData(result)
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

  async function handleResend(target: Member) {
    setBusyId(target.id)
    try {
      await membersService.resendInvitation(target.id)
      message.success(`Invitation renvoyée à ${target.user.email}`)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  function handleSaved(saved: Member, created: boolean) {
    setData((current) => ({
      ...current,
      members: created
        ? [saved, ...current.members]
        : current.members.map((item) => (item.id === saved.id ? saved : item)),
    }))
    setFormMember(undefined)
    message.success(created ? `Invitation envoyée à ${saved.user.email}` : `${saved.user.name} mis à jour`)
  }

  const columns: TableColumnsType<Member> = [
    {
      title: 'Membre',
      key: 'user',
      sorter: (a, b) => a.user.name.localeCompare(b.user.name, 'fr'),
      render: (_, record) => (
        <div className="flex flex-col">
          <Typography.Text strong>{record.user.name}</Typography.Text>
          <Typography.Text type="secondary" className="text-xs">
            {record.user.email}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: 'Rôle',
      key: 'role',
      width: 200,
      filters: data.roles.map((role) => ({ value: role.code, text: role.name })),
      onFilter: (value, record) => record.role.code === value,
      render: (_, record) => {
        const { grants, revokes } = record.permissionOverrides
        const adjusted = grants.length + revokes.length
        return (
          <Space size={4} wrap>
            <Tag color={record.role.code === 'owner' ? 'gold' : 'blue'}>{record.role.name}</Tag>
            {adjusted > 0 && (
              <Tooltip title={`${grants.length} ajout(s), ${revokes.length} retrait(s) par rapport au rôle`}>
                <Tag color="purple">droits ajustés</Tag>
              </Tooltip>
            )}
          </Space>
        )
      },
    },
    {
      title: 'Boutiques',
      key: 'shops',
      responsive: ['md'],
      render: (_, record) =>
        record.allShops ? (
          <Tag>Toutes</Tag>
        ) : record.shops.length === 0 ? (
          <Typography.Text type="secondary">Aucune</Typography.Text>
        ) : (
          <Space size={4} wrap>
            {record.shops.map((shop) => (
              <Tag key={shop.id}>{shop.name}</Tag>
            ))}
          </Space>
        ),
    },
    {
      title: 'Statut',
      key: 'status',
      width: 170,
      render: (_, record) =>
        record.status === 'disabled' ? (
          <Tag>Désactivé</Tag>
        ) : record.user.invitationPending ? (
          <Tag color="orange">Invitation en attente</Tag>
        ) : (
          <Tag color="green">Actif</Tag>
        ),
    },
    {
      title: 'Ajouté le',
      dataIndex: 'createdAt',
      width: 120,
      responsive: ['lg'],
      sorter: (a, b) => a.createdAt.localeCompare(b.createdAt),
      render: (value: string) => dateFormatter.format(new Date(value)),
    },
    {
      title: '',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Droits">
            <Button
              icon={<SafetyOutlined />}
              size="small"
              onClick={() => setPermissionsMember(record)}
              aria-label={`Droits de ${record.user.name}`}
            />
          </Tooltip>
          <Tooltip title={record.editable ? 'Modifier' : 'Vous ne pouvez pas modifier ce membre'}>
            <Button
              icon={<EditOutlined />}
              size="small"
              disabled={!record.editable}
              onClick={() => setFormMember(record)}
              aria-label={`Modifier ${record.user.name}`}
            />
          </Tooltip>
          {record.user.invitationPending && record.editable && (
            <Tooltip title="Renvoyer l’invitation">
              <Button
                icon={<MailOutlined />}
                size="small"
                loading={busyId === record.id}
                onClick={() => handleResend(record)}
                aria-label={`Renvoyer l’invitation à ${record.user.name}`}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Typography.Title level={2} className="mb-0">
          Équipe
        </Typography.Title>
        <div className="flex gap-2">
          <Button icon={<ReloadOutlined />} onClick={reload} loading={loading}>
            Actualiser
          </Button>
          <Button type="primary" icon={<UserAddOutlined />} onClick={() => setFormMember(null)}>
            Inviter un membre
          </Button>
        </div>
      </div>

      {error && <Alert type="error" title={error} showIcon />}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<Member>
          rowKey="id"
          columns={columns}
          dataSource={data.members}
          loading={loading}
          pagination={{ pageSize: 20, hideOnSinglePage: true }}
          scroll={{ x: 800 }}
        />
      </Card>

      <MemberFormModal
        key={formMember?.id ?? 'new'}
        open={formMember !== undefined}
        member={formMember ?? null}
        roles={data.roles}
        shops={data.shops}
        onCancel={() => setFormMember(undefined)}
        onSaved={handleSaved}
      />

      {permissionsMember && (
        <MemberPermissionsDrawer
          key={permissionsMember.id}
          member={permissionsMember}
          groups={data.groups}
          onClose={() => setPermissionsMember(null)}
          // Les droits effectifs et le badge "droits ajustés" de la liste changent
          onSaved={() => void load()}
        />
      )}
    </div>
  )
}
