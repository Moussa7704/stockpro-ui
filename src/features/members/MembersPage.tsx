import { MailOutlined, ReloadOutlined, UserAddOutlined } from '@ant-design/icons'
import { Alert, App, Button, Card, Select, Table, Tag, Tooltip, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { ROLES, ROLE_OPTIONS } from '../../constants/roles'
import { useAuth } from '../../hook/useAuth'
import { getErrorMessage } from '../../services/api'
import * as usersService from '../../services/users.service'
import type { User, UserRole } from '../../types/auth'
import { InviteUserModal } from './InviteUserModal'

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' })

/** Gestion des comptes (admins uniquement) : invitation, rôles, renvoi d'invitation. */
export function UsersPage() {
  const { user: me } = useAuth()
  const { message } = App.useApp()

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  // Ligne en cours de modification (rôle ou renvoi) : affiche un chargement sur elle seule
  const [busyId, setBusyId] = useState<string | null>(null)

  // Applique le résultat d'un chargement (sauf si la page a été quittée entre-temps)
  const fetchUsers = useCallback((isCancelled: () => boolean = () => false) => {
    return usersService
      .listUsers()
      .then(({ users: list }) => {
        if (!isCancelled()) {
          setUsers(list)
          setError(null)
        }
      })
      .catch((err: unknown) => !isCancelled() && setError(getErrorMessage(err)))
      .finally(() => !isCancelled() && setLoading(false))
  }, [])

  // Premier chargement (loading vaut déjà true au départ)
  useEffect(() => {
    let cancelled = false
    void fetchUsers(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [fetchUsers])

  // Bouton "Actualiser"
  function loadUsers() {
    setLoading(true)
    void fetchUsers()
  }

  async function handleRoleChange(target: User, role: UserRole) {
    setBusyId(target.id)
    try {
      const { user: updated } = await usersService.updateUserRole(target.id, role)
      setUsers((list) => list.map((item) => (item.id === updated.id ? updated : item)))
      message.success(`${updated.name} est maintenant ${ROLES[role].label.toLowerCase()}`)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  async function handleResend(target: User) {
    setBusyId(target.id)
    try {
      await usersService.resendInvitation(target.id)
      message.success(`Invitation renvoyée à ${target.email}`)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  function handleInvited(created: User) {
    setUsers((list) => [created, ...list])
    setInviteOpen(false)
    message.success(`Invitation envoyée à ${created.email}`)
  }

  const columns: TableColumnsType<User> = [
    {
      title: 'Nom',
      dataIndex: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name, 'fr'),
    },
    {
      title: 'Email',
      dataIndex: 'email',
    },
    {
      title: 'Rôle',
      dataIndex: 'role',
      width: 190,
      filters: ROLE_OPTIONS.map(({ value, label }) => ({ value, text: label })),
      onFilter: (value, record) => record.role === value,
      render: (role: UserRole, record) =>
        // Un admin ne peut pas changer son propre rôle (le serveur le refuse aussi)
        record.id === me?.id ? (
          <Tooltip title="Vous ne pouvez pas modifier votre propre rôle">
            <Tag color={ROLES[role].color}>{ROLES[role].label}</Tag>
          </Tooltip>
        ) : (
          <Select<UserRole>
            value={role}
            options={ROLE_OPTIONS}
            onChange={(value) => handleRoleChange(record, value)}
            loading={busyId === record.id}
            disabled={busyId === record.id}
            className="w-40"
            aria-label={`Rôle de ${record.name}`}
          />
        ),
    },
    {
      title: 'Statut',
      key: 'status',
      width: 170,
      render: (_, record) =>
        record.invitationPending ? (
          <Tag color="orange">Invitation en attente</Tag>
        ) : (
          <Tag color="green">Actif</Tag>
        ),
    },
    {
      title: 'Créé le',
      dataIndex: 'createdAt',
      width: 130,
      responsive: ['md'],
      sorter: (a, b) => a.createdAt.localeCompare(b.createdAt),
      render: (value: string) => dateFormatter.format(new Date(value)),
    },
    {
      title: '',
      key: 'actions',
      width: 200,
      render: (_, record) =>
        record.invitationPending && (
          <Button
            icon={<MailOutlined />}
            size="small"
            onClick={() => handleResend(record)}
            loading={busyId === record.id}
          >
            Renvoyer l’invitation
          </Button>
        ),
    },
  ]

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Typography.Title level={2} className="mb-0">
          Utilisateurs
        </Typography.Title>
        <div className="flex gap-2">
          <Button icon={<ReloadOutlined />} onClick={loadUsers} loading={loading}>
            Actualiser
          </Button>
          <Button type="primary" icon={<UserAddOutlined />} onClick={() => setInviteOpen(true)}>
            Inviter un utilisateur
          </Button>
        </div>
      </div>

      {error && <Alert type="error" title={error} showIcon />}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<User>
          rowKey="id"
          columns={columns}
          dataSource={users}
          loading={loading}
          pagination={{ pageSize: 20, hideOnSinglePage: true }}
          scroll={{ x: 800 }}
        />
      </Card>

      <InviteUserModal open={inviteOpen} onCancel={() => setInviteOpen(false)} onInvited={handleInvited} />
    </div>
  )
}
