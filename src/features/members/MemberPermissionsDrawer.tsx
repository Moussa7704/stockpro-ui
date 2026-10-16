import { Alert, App, Button, Drawer, Skeleton, Tag, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { PermissionChecklist } from '../../components/PermissionChecklist'
import { getErrorMessage } from '../../services/api'
import * as membersService from '../../services/members.service'
import type { Member, MemberPermissions, Permission, PermissionGroup } from '../../types/access'

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
  const [details, setDetails] = useState<MemberPermissions | null>(null)
  const [checked, setChecked] = useState<Permission[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const memberId = member.id

  useEffect(() => {
    let cancelled = false
    membersService
      .getMemberPermissions(memberId)
      .then(({ permissions }) => {
        if (cancelled) return
        setDetails(permissions)
        setChecked(permissions.permissions)
      })
      .catch((err: unknown) => !cancelled && setError(getErrorMessage(err)))
    return () => {
      cancelled = true
    }
  }, [memberId])

  const rolePermissions = new Set(details?.role.permissions ?? [])
  const grantable = new Set(details?.grantable ?? [])
  const editable = details?.editable ?? false

  async function handleSave() {
    const isChecked = new Set(checked)
    // Écart avec le rôle : ce qui est coché en plus (ajouts) ou décoché (retraits)
    const grants = checked.filter((permission) => !rolePermissions.has(permission))
    const revokes = [...rolePermissions].filter((permission) => !isChecked.has(permission))
    setSaving(true)
    setError(null)
    try {
      const { permissions } = await membersService.setMemberPermissions(memberId, { grants, revokes })
      setDetails(permissions)
      setChecked(permissions.permissions)
      message.success('Droits mis à jour')
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

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
            <Button onClick={() => setChecked(details?.role.permissions ?? [])} disabled={saving}>
              Revenir au rôle
            </Button>
            <Button type="primary" onClick={handleSave} loading={saving}>
              Enregistrer
            </Button>
          </div>
        )
      }
    >
      {error && <Alert type="error" title={error} showIcon className="mb-4" />}

      {!details ? (
        !error && <Skeleton active />
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
            onChange={setChecked}
            // On n'accorde ou ne retire que des permissions qu'on possède soi-même
            isDisabled={(permission) => !editable || !grantable.has(permission)}
            renderExtra={renderExtra}
          />
        </div>
      )}
    </Drawer>
  )
}
