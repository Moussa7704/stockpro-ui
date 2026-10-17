import { EditOutlined, MailOutlined, ReloadOutlined, SafetyOutlined, UserAddOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Space, Table, Tag, Tooltip, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { useState } from 'react'
import { useShops } from '../../hook/useActiveShop'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage } from '../../services/api'
import * as membersService from '../../services/members.service'
import type { Member } from '../../types/access'
import { usePermissionCatalog, useRoles } from '../roles/queries'
import { MemberFormModal } from './MemberFormModal'
import { MemberPermissionsDrawer } from './MemberPermissionsDrawer'
import { useMembers } from './queries'

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' })

/**
 * Équipe de l'entreprise (permission users.manage) : invitation, rôle, boutiques, statut
 * et ajustement des droits. `editable` (calculé par le serveur) dit qui on peut modifier.
 */
export function MembersPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()

  const members = useMembers()
  const roles = useRoles()
  const shops = useShops()
  const catalog = usePermissionCatalog()
  const queries = [members, roles, shops, catalog]
  const loading = queries.some((query) => query.isFetching)
  const firstError = queries.find((query) => query.error)?.error
  const error = firstError ? getErrorMessage(firstError) : null

  // undefined : modal fermée ; null : invitation ; Member : modification
  const [formMember, setFormMember] = useState<Member | null | undefined>(undefined)
  const [permissionsMember, setPermissionsMember] = useState<Member | null>(null)

  function reload() {
    queries.forEach((query) => void query.refetch())
  }

  const resend = useMutation({
    mutationFn: (target: Member) => membersService.resendInvitation(target.id),
    onSuccess: (_result, target) => message.success(`Invitation renvoyée à ${target.user.email}`),
    onError: (err) => message.error(getErrorMessage(err)),
  })

  /** Après un changement de membre : la liste, et le nombre de membres par rôle. */
  function refreshTeam() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.members.all })
    void queryClient.invalidateQueries({ queryKey: queryKeys.roles.all })
  }

  function handleSaved(saved: Member, created: boolean) {
    // Affichage immédiat, puis relecture du serveur (droits effectifs, compteurs des rôles)
    queryClient.setQueryData<Member[]>(queryKeys.members.all, (current = []) =>
      created ? [saved, ...current] : current.map((item) => (item.id === saved.id ? saved : item)),
    )
    refreshTeam()
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
      filters: (roles.data ?? []).map((role) => ({ value: role.code, text: role.name })),
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
                loading={resend.isPending && resend.variables?.id === record.id}
                onClick={() => resend.mutate(record)}
                aria-label={`Renvoyer l’invitation à ${record.user.name}`}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
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
          dataSource={members.data ?? []}
          loading={members.isPending}
          pagination={{ pageSize: 20, hideOnSinglePage: true }}
          scroll={{ x: 800 }}
        />
      </Card>

      <MemberFormModal
        key={formMember?.id ?? 'new'}
        open={formMember !== undefined}
        member={formMember ?? null}
        roles={roles.data ?? []}
        shops={shops.data ?? []}
        onCancel={() => setFormMember(undefined)}
        onSaved={handleSaved}
      />

      {permissionsMember && (
        <MemberPermissionsDrawer
          key={permissionsMember.id}
          member={permissionsMember}
          groups={catalog.data ?? []}
          onClose={() => setPermissionsMember(null)}
          // Les droits effectifs et le badge "droits ajustés" de la liste changent
          onSaved={refreshTeam}
        />
      )}
    </div>
  )
}
