import { Checkbox, Typography } from 'antd'
import type { ReactNode } from 'react'
import type { Permission, PermissionGroup } from '../types/access'

interface PermissionChecklistProps {
  groups: PermissionGroup[]
  value: Permission[]
  onChange: (value: Permission[]) => void
  /** Case grisée (ex. permission que l'utilisateur connecté ne possède pas). */
  isDisabled?: (permission: Permission) => boolean
  /** Contenu affiché après le libellé (ex. "ajouté", "retiré"). */
  renderExtra?: (permission: Permission) => ReactNode
}

/** Cases à cocher des permissions, regroupées comme le catalogue du serveur (GET /permissions). */
export function PermissionChecklist({ groups, value, onChange, isDisabled, renderExtra }: PermissionChecklistProps) {
  const checked = new Set(value)

  function toggle(permission: Permission, on: boolean) {
    const next = new Set(checked)
    if (on) next.add(permission)
    else next.delete(permission)
    onChange([...next])
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <section key={group.label}>
          <Typography.Text strong>{group.label}</Typography.Text>
          <div className="mt-2 flex flex-col gap-1.5">
            {group.permissions.map(({ code, label }) => (
              <div key={code} className="flex items-center justify-between gap-2">
                <Checkbox
                  checked={checked.has(code)}
                  disabled={isDisabled?.(code)}
                  onChange={(event) => toggle(code, event.target.checked)}
                >
                  {label}
                </Checkbox>
                {renderExtra?.(code)}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
