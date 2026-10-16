import { MailOutlined, UserOutlined } from '@ant-design/icons'
import { Alert, Form, Input, Modal, Select, Switch, Typography } from 'antd'
import { useState } from 'react'
import { canAssignRole } from '../../constants/access'
import { useAuth } from '../../hook/useAuth'
import { getErrorMessage } from '../../services/api'
import * as membersService from '../../services/members.service'
import type { Member, Role, ShopSummary } from '../../types/access'

interface MemberValues {
  name: string
  email: string
  roleCode: string
  allShops: boolean
  shopIds: string[]
  active: boolean
}

interface MemberFormModalProps {
  open: boolean
  /** null : invitation d'un nouveau membre ; sinon modification. */
  member: Member | null
  roles: Role[]
  shops: ShopSummary[]
  onCancel: () => void
  onSaved: (member: Member, created: boolean) => void
}

/**
 * Invitation (la personne choisit son mot de passe via le lien reçu par email)
 * ou modification du rôle, des boutiques et du statut d'un membre.
 */
export function MemberFormModal({ open, member, roles, shops, onCancel, onSaved }: MemberFormModalProps) {
  const { activeCompany } = useAuth()
  const [form] = Form.useForm<MemberValues>()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const allShops = Form.useWatch('allShops', form)

  const isEdit = member !== null
  // On ne propose que les rôles qu'on a le droit d'attribuer (+ le rôle actuel, pour l'afficher)
  const roleOptions = roles
    .filter((role) => (activeCompany && canAssignRole(activeCompany, role)) || role.code === member?.role.code)
    .map((role) => ({ value: role.code, label: role.name }))
  // Seul quelqu'un qui voit toutes les boutiques peut donner accès à toutes les boutiques
  const canGrantAllShops = activeCompany?.allShops ?? false

  async function handleSubmit(values: MemberValues) {
    setError(null)
    setSubmitting(true)
    const shopIds = values.allShops ? [] : (values.shopIds ?? [])
    try {
      const result = isEdit
        ? await membersService.updateMember(member.id, {
            roleCode: values.roleCode,
            allShops: values.allShops,
            shopIds,
            status: values.active ? 'active' : 'disabled',
          })
        : await membersService.inviteMember({
            name: values.name,
            email: values.email,
            roleCode: values.roleCode,
            allShops: values.allShops,
            shopIds,
          })
      form.resetFields()
      onSaved(result.member, !isEdit)
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
      title={isEdit ? `Modifier ${member.user.name}` : 'Inviter un membre'}
      open={open}
      onCancel={handleCancel}
      onOk={() => form.submit()}
      okText={isEdit ? 'Enregistrer' : 'Envoyer l’invitation'}
      cancelText="Annuler"
      confirmLoading={submitting}
      destroyOnHidden
    >
      {!isEdit && (
        <Typography.Paragraph type="secondary">
          La personne recevra un email pour choisir son mot de passe (lien valable 48 h). Si elle a déjà un
          compte StockPro, elle est simplement ajoutée à l’entreprise.
        </Typography.Paragraph>
      )}

      <Form<MemberValues>
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark={false}
        initialValues={
          isEdit
            ? {
                roleCode: member.role.code,
                allShops: member.allShops,
                shopIds: member.shops.map((shop) => shop.id),
                active: member.status === 'active',
              }
            : { allShops: false, shopIds: [], active: true }
        }
      >
        {!isEdit && (
          <>
            <Form.Item
              name="name"
              label="Nom"
              rules={[
                { required: true, whitespace: true, message: 'Saisissez le nom' },
                { min: 2, max: 100, message: 'Entre 2 et 100 caractères' },
              ]}
            >
              <Input prefix={<UserOutlined />} autoFocus />
            </Form.Item>

            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: 'Saisissez l’email' },
                { type: 'email', message: 'Email invalide' },
              ]}
            >
              <Input prefix={<MailOutlined />} />
            </Form.Item>
          </>
        )}

        <Form.Item name="roleCode" label="Rôle" rules={[{ required: true, message: 'Choisissez un rôle' }]}>
          <Select options={roleOptions} placeholder="Choisir un rôle" />
        </Form.Item>

        {canGrantAllShops && (
          <Form.Item name="allShops" label="Accès à toutes les boutiques" valuePropName="checked">
            <Switch />
          </Form.Item>
        )}

        {!allShops && (
          <Form.Item name="shopIds" label="Boutiques" extra="Le membre ne voit que les boutiques cochées.">
            <Select
              mode="multiple"
              allowClear
              placeholder="Aucune boutique"
              options={shops.map((shop) => ({ value: shop.id, label: `${shop.name} (${shop.code})` }))}
              optionFilterProp="label"
            />
          </Form.Item>
        )}

        {isEdit && (
          <Form.Item
            name="active"
            label="Accès actif"
            valuePropName="checked"
            extra="Désactivé : le membre ne peut plus travailler dans l’entreprise."
          >
            <Switch />
          </Form.Item>
        )}

        {error && <Alert type="error" title={error} showIcon />}
      </Form>
    </Modal>
  )
}
