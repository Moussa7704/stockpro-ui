import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Drawer, Skeleton, Tag, Typography } from 'antd'
import { useState } from 'react'
import { PermissionChecklist } from '../../components/PermissionChecklist'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage } from '../../services/api'
import * as membersService from '../../services/members.service'
import type { Member, Permission, PermissionGroup } from '../../types/access'
import { useMemberPermissions } from './queries'

interface MemberPermissionsDrawerProps {
  /** Le parent monte le tiroir avec key={member.id} : l'état repart de zéro pour chaque membre. */
  member: Member
  groups: PermissionGroup[]
  onClose: () => void
  onSaved: () => void
}

/**
 * Droits effectifs d'un membre = permissions de son rôle + ajouts − retraits.
 * On coche ce que le membre doit pouvoir faire ; l'écart avec le rôle devient des ajouts / retraits.
 */
export function MemberPermissionsDrawer({ member, groups, onClose, onSaved }: MemberPermissionsDrawerProps) {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const memberId = member.id
  const { data: details, error: loadError } = useMemberPermissions(memberId)
  // null : rien de modifié, on affiche les droits enregistrés
  const [edited, setEdited] = useState<Permission[] | null>(null)
  const checked = edited ?? details?.permissions ?? []

  const rolePermissions = new Set(details?.role.permissions ?? [])
  const grantable = new Set(details?.grantable ?? [])
  const editable = details?.editable ?? false

  const save = useMutation({
    mutationFn: () => {
      const isChecked = new Set(checked)
      // Écart avec le rôle : ce qui est coché en plus (ajouts) ou décoché (retraits)
      const grants = checked.filter((permission) => !rolePermissions.has(permission))
      const revokes = [...rolePermissions].filter((permission) => !isChecked.has(permission))
      return membersService.setMemberPermissions(memberId, { grants, revokes })
    },
    onSuccess: ({ permissions }) => {
      queryClient.setQueryData(queryKeys.members.permissions(memberId), permissions)
      setEdited(null)
      message.success('Droits mis à jour')
      onSaved()
    },
  })

  const error = save.error ?? loadError

  function renderExtra(permission: Permission) {
    const inRole = rolePermissions.has(permission)
    const isOn = checked.includes(permission)
    if (isOn && !inRole) return <Tag color="green">ajouté</Tag>
    if (!isOn && inRole) return <Tag color="red">retiré</Tag>
    return null
  }

  return (
    <Drawer
      title={`Droits de ${member.user.name}`}
      open
      onClose={onClose}
      size={520}
      destroyOnHidden
      footer={
        editable && (
          <div className="flex justify-between gap-2">
            <Button onClick={() => setEdited(details?.role.permissions ?? [])} disabled={save.isPending}>
              Revenir au rôle
            </Button>
            <Button type="primary" onClick={() => save.mutate()} loading={save.isPending}>
              Enregistrer
            </Button>
          </div>
        )
      }
    >
      {error && <Alert type="error" title={getErrorMessage(error)} showIcon className="mb-4" />}

      {!details ? (
        !loadError && <Skeleton active />
      ) : (
        <div className="flex flex-col gap-4">
          <Typography.Paragraph type="secondary" className="mb-0">
            Rôle : <Tag>{details.role.name}</Tag>
            Cochez ce que ce membre peut faire. Les différences avec son rôle sont marquées
            « ajouté » ou « retiré ».
          </Typography.Paragraph>

          {!editable && (
            <Alert
              type="info"
              showIcon
              title="Lecture seule"
              description="Vous ne pouvez pas modifier vos propres droits, ceux d’un propriétaire, ou ceux d’un membre qui a plus de droits que vous."
            />
          )}

          <PermissionChecklist
            groups={groups}
            value={checked}
            onChange={setEdited}
            // On n'accorde ou ne retire que des permissions qu'on possède soi-même
            isDisabled={(permission) => !editable || !grantable.has(permission)}
            renderExtra={renderExtra}
          />
        </div>
      )}
    </Drawer>
  )
}
