import { Alert, Form, Input, Modal, Typography } from 'antd'
import { useState } from 'react'
import { PermissionChecklist } from '../../components/PermissionChecklist'
import { OWNER_ROLE_CODE } from '../../constants/access'
import { useAuth } from '../../hook/useAuth'
import { getErrorMessage } from '../../services/api'
import * as rolesService from '../../services/roles.service'
import type { Permission, PermissionGroup, Role } from '../../types/access'

interface RoleValues {
  name: string
  description?: string
  permissions: Permission[]
}

interface RoleFormModalProps {
  open: boolean
  /** null : création d'un rôle personnalisé ; sinon modification. */
  role: Role | null
  groups: PermissionGroup[]
  onCancel: () => void
  onSaved: (role: Role, created: boolean) => void
}

/** Un nom et des permissions cochées, jamais au-delà de ses propres droits (vérifié par l'API). */
export function RoleFormModal({ open, role, groups, onCancel, onSaved }: RoleFormModalProps) {
  const { activeCompany } = useAuth()
  const [form] = Form.useForm<RoleValues>()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isEdit = role !== null
  const isOwner = activeCompany?.role.code === OWNER_ROLE_CODE
  const mine = new Set(activeCompany?.permissions ?? [])

  async function handleSubmit(values: RoleValues) {
    setError(null)
    setSubmitting(true)
    const input = {
      name: values.name,
      description: values.description?.trim() || null,
      permissions: values.permissions,
    }
    try {
      const result = isEdit ? await rolesService.updateRole(role.id, input) : await rolesService.createRole(input)
      form.resetFields()
      onSaved(result.role, !isEdit)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  function handleCancel() {
    setError(null)
    form.resetFields()
    onCancel()
  }

  return (
    <Modal
      title={isEdit ? `Modifier le rôle « ${role.name} »` : 'Nouveau rôle'}
      open={open}
      onCancel={handleCancel}
      onOk={() => form.submit()}
      okText={isEdit ? 'Enregistrer' : 'Créer le rôle'}
      cancelText="Annuler"
      confirmLoading={submitting}
      width={640}
      destroyOnHidden
    >
      {isEdit && role.memberCount > 0 && (
        <Typography.Paragraph type="secondary">
          Les changements s’appliquent immédiatement aux {role.memberCount} membre(s) qui ont ce rôle.
        </Typography.Paragraph>
      )}

      <Form<RoleValues>
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark={false}
        initialValues={
          isEdit
            ? { name: role.name, description: role.description ?? '', permissions: role.permissions }
            : { permissions: [] }
        }
      >
        <Form.Item
          name="name"
          label="Nom"
          rules={[
            { required: true, whitespace: true, message: 'Saisissez le nom' },
            { min: 2, max: 80, message: 'Entre 2 et 80 caractères' },
          ]}
        >
          <Input placeholder="Ex. Vendeur senior" autoFocus />
        </Form.Item>

        <Form.Item name="description" label="Description" rules={[{ max: 255, message: '255 caractères maximum' }]}>
          <Input.TextArea autoSize={{ minRows: 1, maxRows: 3 }} placeholder="Facultatif" />
        </Form.Item>

        <Form.Item
          name="permissions"
          label="Permissions"
          rules={[{ type: 'array', min: 1, message: 'Cochez au moins une permission' }]}
          extra={!isOwner && 'Les permissions grisées sont celles que vous n’avez pas vous-même.'}
        >
          <PermissionChecklistField groups={groups} isDisabled={(permission) => !isOwner && !mine.has(permission)} />
        </Form.Item>

        {error && <Alert type="error" title={error} showIcon />}
      </Form>
    </Modal>
  )
}

// Form.Item injecte value / onChange dans son enfant
function PermissionChecklistField({
  value = [],
  onChange,
  ...props
}: {
  value?: Permission[]
  onChange?: (value: Permission[]) => void
  groups: PermissionGroup[]
  isDisabled: (permission: Permission) => boolean
}) {
  return <PermissionChecklist value={value} onChange={(next) => onChange?.(next)} {...props} />
}
